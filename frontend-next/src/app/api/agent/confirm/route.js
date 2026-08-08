import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import AgentSession from "@/lib/models/AgentSession"
import UserCharacters from "@/lib/models/UserCharacters"
import GuildSettings from "@/lib/models/GuildSettings"
import { RAIDS } from "@/lib/raidCatalog"
import { SUPPORTER_CLASSES } from "@/lib/lostarkData"
import { createRaid } from "@/lib/raidService"

function findRaidByAlias(alias) {
  for (const cat of RAIDS) {
    const found = cat.raids.find(r => r.alias === alias)
    if (found) return found
  }
  return null
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.discordId || session.user.id

    const { sessionId } = await request.json()
    if (!sessionId) {
      return Response.json({ error: "sessionId가 필요합니다." }, { status: 400 })
    }

    await connectDB()

    const agentSession = await AgentSession.findOne({ _id: sessionId, userId })
    if (!agentSession) {
      return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 })
    }

    const draft = agentSession.draft
    const isReady = agentSession.status === "ready" && (draft.missingFields?.length || 0) === 0
    if (!isReady) {
      return Response.json({ error: "아직 확정할 수 없는 초안입니다." }, { status: 400 })
    }

    // raidAlias → raidName/raidTag/maxPlayers 카탈로그 조회 (Claude가 지어내지 않도록 반드시 여기서 resolve)
    const catalogRaid = findRaidByAlias(draft.raidAlias)
    if (!catalogRaid) {
      return Response.json({ error: "유효하지 않은 레이드입니다." }, { status: 400 })
    }

    // raidAlias + difficulty 조합이 카탈로그에 실제로 존재하는 조합인지 최종 검증 (chat 단계 프롬프트 유도의 이중 방어)
    const validDifficulty = catalogRaid.difficulties.some(d => d.name === draft.difficulty)
    if (!validDifficulty) {
      return Response.json({ error: "유효하지 않은 난이도 조합입니다." }, { status: 400 })
    }

    // Discord 공고 채널 (GuildSettings 기준 — 웹 폼과 동일한 소스)
    const guildSettings = await GuildSettings.findOne({ guildId: agentSession.guildId })
    const discordChannelId = guildSettings?.announcementChannelId || null

    let hostCharacter = null
    let hostRole = draft.hostRole
    if (hostRole !== "none") {
      const userChars = await UserCharacters.findOne({ discordId: userId })
      const matched = (userChars?.characters || []).find(c => c.name === draft.hostCharacterName)
      if (!matched) {
        return Response.json({ error: "등록된 캐릭터 중에서 주최자 캐릭터를 찾을 수 없습니다." }, { status: 400 })
      }
      // Claude가 잘못 판단했을 경우를 대비해 SUPPORTER_CLASSES 기준으로 role 재검증
      hostRole = SUPPORTER_CLASSES.includes(matched.class) ? "support" : "dealer"
      hostCharacter = {
        name: matched.name,
        class: matched.class,
        level: matched.level,
        combatPower: matched.combatPower || null,
      }
    }

    let raid
    try {
      raid = await createRaid({
        hostId: userId,
        hostName: session.user.name,
        hostImage: session.user.image,
        raidName: catalogRaid.name,
        raidAlias: catalogRaid.alias,
        raidTag: catalogRaid.tag,
        difficulty: draft.difficulty,
        maxPlayers: catalogRaid.maxPlayers,
        date: draft.date,
        time: draft.time,
        isMobaChul: draft.isMobaChul || false,
        discordChannelId,
        guildId: agentSession.guildId,
        hostRole,
        hostCharacter,
        hostNsuCharacters: null,
        hostNsuRoles: null,
        difficultyLevel: draft.difficultyLevel,
        trains: null,
        trainLabel: undefined,
        notifyMinutesBefore: 30,
        totalRounds: 1,
      })
    } catch (createError) {
      console.error("에이전트 레이드 생성 오류:", createError)
      // 실패 시 재시도 가능하도록 ready 상태 유지
      agentSession.status = "ready"
      await agentSession.save()
      return Response.json({ error: "레이드 생성 중 오류가 발생했습니다." }, { status: 500 })
    }

    agentSession.status = "confirmed"
    await agentSession.save()

    return Response.json({ success: true, raid })

  } catch (error) {
    console.error("에이전트 확정 오류:", error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
