import Anthropic from "@anthropic-ai/sdk"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import AgentSession from "@/lib/models/AgentSession"
import UserCharacters from "@/lib/models/UserCharacters"
import { RAIDS } from "@/lib/raidCatalog"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_TURNS = 40

const UPDATE_RAID_DRAFT_TOOL = {
  name: "update_raid_draft",
  description: "사용자 발화에서 추출한 레이드 정보로 초안을 갱신. 확실하지 않은 필드는 생략",
  input_schema: {
    type: "object",
    properties: {
      raidAlias: { type: "string" },
      difficulty: { type: "string", enum: ["노말", "하드"] },
      difficultyLevel: { type: "string", enum: ["헤딩", "트라이", "클경", "반숙", "숙련", "숙제"] },
      date: { type: "string", description: "ISO 8601 YYYY-MM-DD, KST 기준" },
      time: { type: "string", description: "HH:mm, KST 기준" },
      maxPlayers: { type: "integer" },
      isMobaChul: { type: "boolean" },
      hostRole: { type: "string", enum: ["dealer", "support", "none"] },
      hostCharacterName: { type: "string", description: "hostRole이 none이 아닐 때만. 시스템 프롬프트의 등록 캐릭터 목록 중 정확히 일치하는 이름" },
      ready: { type: "boolean", description: "필수 필드가 모두 채워져 확인 요청 가능한 상태인지" },
    },
  },
}

function getRaidAliasList() {
  return RAIDS.flatMap(cat => cat.raids.map(r => r.alias))
}

function findRaidByAlias(alias) {
  for (const cat of RAIDS) {
    const found = cat.raids.find(r => r.alias === alias)
    if (found) return found
  }
  return null
}

// 시:분 없이 날짜 단위만 반환 — "오늘 밤 9시" 파싱엔 오늘 '날짜'만 있으면 충분하고,
// 시각까지 넣으면 system prompt 캐시(cache_control)가 매 요청마다 깨짐
function todayKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth() + 1
  const d = kst.getUTCDate()
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"]
  const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  return { dateStr, dayName: dayNames[kst.getUTCDay()] }
}

// missingFields 필드명 → 되물을 한국어 질문 문구
const MISSING_FIELD_QUESTIONS = {
  raidAlias: "어떤 레이드로 예약할까요?",
  difficulty: "난이도는 노말/하드 중 어느 쪽인가요?",
  difficultyLevel: "숙련도는 헤딩/트라이/클경/반숙/숙련/숙제 중 어느 쪽인가요?",
  date: "날짜는 언제로 할까요?",
  time: "시간은 몇 시로 할까요?",
  hostRole: "호스트 역할을 딜러/서포터/모집만 중에서 알려주세요.",
  hostCharacterName: "어떤 캐릭터로 참가하실 건가요?",
}

// Claude가 텍스트 없이 툴 호출만 하고 끝내는 경우를 대비한 서버 사이드 안전망 (API 재호출 없음)
function buildFallbackReply(missingFields) {
  if (missingFields.length === 0) return "모든 정보가 확인됐어요. 이대로 만들까요?"
  return missingFields.slice(0, 2).map(f => MISSING_FIELD_QUESTIONS[f] || f).join(" ")
}

function computeMissingFields(draft) {
  const missing = []
  if (!draft.raidAlias) missing.push("raidAlias")
  if (!draft.difficulty) missing.push("difficulty")
  if (!draft.difficultyLevel) missing.push("difficultyLevel")
  if (!draft.isMobaChul) {
    if (!draft.date) missing.push("date")
    if (!draft.time) missing.push("time")
  }
  if (!draft.hostRole) missing.push("hostRole")
  if (draft.hostRole && draft.hostRole !== "none" && !draft.hostCharacterName) missing.push("hostCharacterName")
  return missing
}

// 캐싱 대상(정적) 시스템 프롬프트 — 유저별 캐릭터 목록/오늘 날짜는 세션 내내 바뀌지 않으므로 포함
function buildStaticSystemPrompt({ dateStr, dayName, characters, raidAliases }) {
  const charList = characters.length > 0
    ? characters.map(c => `- ${c.name} (${c.class})`).join("\n")
    : "(등록된 캐릭터 없음)"

  return `당신은 로스트아크 레이드 예약 시스템 "로미니"의 대화형 레이드 생성 도우미입니다.
사용자의 자연어 발화에서 레이드 예약에 필요한 정보를 추출해 update_raid_draft 도구를 호출하세요.

## 오늘 날짜
${dateStr} (${dayName}요일, KST 기준) — "오늘", "내일", "이번 주 토요일" 같은 상대 표현은 이 날짜를 기준으로 계산하세요.

## 이 사용자가 등록한 캐릭터 목록
${charList}

## 유효한 레이드 별칭(raidAlias) 목록
${raidAliases.join(", ")}
이 목록에 없는 이름은 raidAlias로 사용하지 마세요.

## 지침
- 정보가 부족하면 자연스러운 한국어로 되물으세요. 한 번에 너무 많은 질문을 하지 마세요.
- raidAlias, difficulty, difficultyLevel, date, time, maxPlayers, isMobaChul는 캐릭터 등록 여부와 무관하게 항상 정상적으로 추출하세요. 캐릭터가 없다는 이유로 이 필드들의 추출을 미루거나 대화를 막지 마세요.
- 충분한 정보가 모이면 반드시 update_raid_draft 도구를 호출하세요. 확실하지 않은 필드는 생략하세요.
- 이번 턴에 확실하게 파악한 필드가 하나라도 있다면, 모든 필수 필드가 채워지지 않았더라도 반드시 update_raid_draft를 호출해서 그 필드만이라도 반영하세요. 텍스트 응답만 하고 툴 호출을 생략하지 마세요. 부족한 필드에 대한 질문은 reply 텍스트로, 확실한 필드 반영은 툴 호출로 — 매 턴 둘 다 함께 수행하세요.
- hostRole이 "none"이면 캐릭터 관련 질문/안내는 전혀 하지 마세요.
- 등록된 캐릭터가 하나도 없는 경우, hostRole을 "dealer" 또는 "support"로 확정해야 하는 시점(사용자가 참가 의사를 밝혔거나 hostRole을 물어야 할 때)에만 "/characters에서 캐릭터부터 등록해주세요"라고 안내하세요. 그 외의 필드 수집은 평소대로 계속 진행하세요.
- hostCharacterName은 반드시 위 등록 캐릭터 목록의 이름과 정확히 일치해야 합니다. 목록에 없는 이름은 지어내지 마세요.
- 각 유저 메시지 앞에는 "[현재 초안: {...}]" 형태로 그 시점의 초안 상태가 JSON으로 붙습니다. 이미 채워진 필드는 다시 묻지 마세요.`
}

// 매 턴 바뀌는 현재 초안 상태 — 캐싱 대상 시스템 프롬프트와 분리해 유저 메시지 앞에 짧게 붙임
function buildDraftPrefix(draft) {
  return `[현재 초안: ${JSON.stringify({
    raidAlias: draft.raidAlias,
    difficulty: draft.difficulty,
    difficultyLevel: draft.difficultyLevel,
    date: draft.date,
    time: draft.time,
    isMobaChul: draft.isMobaChul,
    hostRole: draft.hostRole,
    hostCharacterName: draft.hostCharacterName,
  })}]`
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.discordId || session.user.id

    const { sessionId, message, guildId } = await request.json()
    if (!message || !guildId) {
      return Response.json({ error: "message와 guildId가 필요합니다." }, { status: 400 })
    }

    await connectDB()

    let agentSession = sessionId
      ? await AgentSession.findOne({ _id: sessionId, userId })
      : null

    if (!agentSession) {
      agentSession = await AgentSession.create({
        userId,
        guildId,
        messages: [],
        draft: {},
        status: "collecting",
      })
    }

    // 턴 수 제한 (비용 방어) — Claude API 호출 없이 즉시 응답
    if (agentSession.messages.length >= MAX_TURNS) {
      return Response.json({
        sessionId: agentSession._id.toString(),
        reply: "대화가 길어졌어요, 새로 시작해주세요.",
        draft: agentSession.draft,
        ready: agentSession.status === "ready",
      })
    }

    const userChars = await UserCharacters.findOne({ discordId: userId })
    const characters = userChars?.characters || []

    const { dateStr, dayName } = todayKST()
    const raidAliases = getRaidAliasList()
    const staticSystemPrompt = buildStaticSystemPrompt({ dateStr, dayName, characters, raidAliases })

    // 최근 2턴(user+assistant 페어, 최대 4개 메시지)만 맥락으로 포함 — 그 이전 히스토리는 요약 없이 버림
    const recentHistory = agentSession.messages.slice(-4).map(m => ({
      role: m.role,
      content: m.content,
    }))
    const draftPrefix = buildDraftPrefix(agentSession.draft)
    const history = [...recentHistory, { role: "user", content: `${draftPrefix}\n${message}` }]

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: [
        { type: "text", text: staticSystemPrompt, cache_control: { type: "ephemeral" } },
      ],
      tools: [UPDATE_RAID_DRAFT_TOOL],
      tool_choice: { type: "auto" },
      messages: history,
    })

    let reply = ""
    let toolInput = null
    for (const block of response.content) {
      if (block.type === "text") reply += block.text
      if (block.type === "tool_use" && block.name === "update_raid_draft") toolInput = block.input
    }

    const draft = agentSession.draft.toObject ? agentSession.draft.toObject() : { ...agentSession.draft }
    if (toolInput) {
      for (const [key, value] of Object.entries(toolInput)) {
        if (key === "ready") continue  // ready는 missingFields 기반으로 서버가 직접 계산
        if (value !== undefined) draft[key] = value
      }
    }

    // raidAlias는 카탈로그 기준으로 그라운딩 (raidTag/maxPlayers는 Claude가 지어내지 않고 카탈로그에서 파생)
    if (draft.raidAlias) {
      const catalogRaid = findRaidByAlias(draft.raidAlias)
      if (catalogRaid) {
        draft.raidTag = catalogRaid.tag
        draft.maxPlayers = catalogRaid.maxPlayers
      } else {
        draft.raidAlias = agentSession.draft.raidAlias ?? null
        draft.raidTag = agentSession.draft.raidTag ?? null
        draft.maxPlayers = agentSession.draft.maxPlayers ?? null
      }
    }

    const missingFields = computeMissingFields(draft)
    draft.missingFields = missingFields
    const ready = missingFields.length === 0

    if (!reply.trim()) {
      reply = buildFallbackReply(missingFields)
    }

    agentSession.messages.push({ role: "user", content: message, toolCall: null, timestamp: new Date() })
    agentSession.messages.push({ role: "assistant", content: reply, toolCall: toolInput, timestamp: new Date() })
    agentSession.draft = draft
    agentSession.status = ready ? "ready" : "collecting"
    await agentSession.save()

    return Response.json({
      sessionId: agentSession._id.toString(),
      reply,
      draft: agentSession.draft,
      ready,
    })

  } catch (error) {
    console.error("에이전트 채팅 오류:", error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
