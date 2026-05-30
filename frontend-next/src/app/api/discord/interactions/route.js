import { after } from 'next/server'
import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"
import GuildSettings from "@/lib/models/GuildSettings"
import UserCharacters from "@/lib/models/UserCharacters"
import NsuSession from "@/lib/models/NsuSession"
import nacl from "tweetnacl"
import { updateDiscordMessage, sendRaidAnnouncement, updateTrainDiscordMessage, updateTrainRaidDiscordMessage, sendTrainRaidAnnouncement } from "@/lib/discord"
import { sendRaidDM, buildTrainRaidLaunchEmbed } from "@/lib/discordDM"

// 기차/단일 구분에 따라 Discord 메시지 업데이트 (Raid 모델용)
async function updateMessage(raid) {
  if (raid.isTrain) {
    await updateTrainDiscordMessage(raid)
  } else {
    await updateDiscordMessage(raid)
  }
}
import { launchRaid } from "@/lib/raidLaunch"
import { getMinLevel, SUPPORTER_CLASSES } from "@/lib/lostarkData"
import { TRAIN_PRESETS } from "@/lib/trainData"
import { getLoaWeekStart } from "@/lib/loaWeek"

const DISCORD_API = "https://discord.com/api/v10"

// ── 레이드 데이터 ──────────────────────────────────────────────────────────
const RAID_DATA = {
  ekidna:    { raidName: "붉어진 백야의 나선",        raidAlias: "에키드나",   raidTag: "서막",   maxPlayers: 8,  difficulties: ["노말", "하드"] },
  aegir:     { raidName: "대지를 부수는 업화의 궤적",  raidAlias: "에기르",    raidTag: "1막",   maxPlayers: 8,  difficulties: ["노말", "하드"] },
  abrelshud: { raidName: "부유하는 악몽의 진혼곡",     raidAlias: "아브렐슈드", raidTag: "2막",   maxPlayers: 8,  difficulties: ["노말", "하드", "익스트림 노말", "익스트림 하드", "나이트메어"] },
  mordoom:   { raidName: "칠흑, 폭풍의 밤",           raidAlias: "모르둠",    raidTag: "3막",   maxPlayers: 8,  difficulties: ["노말", "하드"] },
  armoche:   { raidName: "파멸의 성채",               raidAlias: "아르모체",  raidTag: "4막",   maxPlayers: 8,  difficulties: ["노말", "하드"] },
  kazeros:   { raidName: "최후의 날",                 raidAlias: "카제로스",  raidTag: "종막",  maxPlayers: 8,  difficulties: ["노말", "하드"] },
  serka:     { raidName: "세르카",                    raidAlias: "세르카",    raidTag: "그림자", maxPlayers: 4, difficulties: ["노말", "하드", "나이트메어"] },
  arsenous:  { raidName: "아르세노스",                raidAlias: "지평의 성당", raidTag: "성당", maxPlayers: 4, difficulties: ["1단계", "2단계", "3단계"] },
}

const RAID_SELECT_OPTIONS = [
  { label: "에키드나 (서막)",     value: "ekidna",    description: "붉어진 백야의 나선 · 8인" },
  { label: "에기르 (1막)",        value: "aegir",     description: "대지를 부수는 업화의 궤적 · 8인" },
  { label: "아브렐슈드 (2막)",    value: "abrelshud", description: "부유하는 악몽의 진혼곡 · 8인" },
  { label: "모르둠 (3막)",        value: "mordoom",   description: "칠흑, 폭풍의 밤 · 8인" },
  { label: "아르모체 (4막)",      value: "armoche",   description: "파멸의 성채 · 8인" },
  { label: "카제로스 (종막)",     value: "kazeros",   description: "최후의 날 · 8인" },
  { label: "세르카 (그림자)",     value: "serka",     description: "세르카 · 4인" },
  { label: "지평의 성당 (어비스)", value: "arsenous",  description: "아르세노스 · 4인" },
]


// IP 기반 rate limit: 10초 window, 최대 20회
const rateLimitMap = new Map()

function checkRateLimit(ip) {
  const now = Date.now()
  const windowMs = 10_000
  const maxRequests = 20
  const entry = rateLimitMap.get(ip)
  if (!entry || now - entry.start > windowMs) {
    rateLimitMap.set(ip, { start: now, count: 1 })
    return false
  }
  entry.count++
  return entry.count > maxRequests
}

async function verifyDiscordRequest(request) {
  const signature = request.headers.get("x-signature-ed25519")
  const timestamp = request.headers.get("x-signature-timestamp")
  if (!signature || !timestamp) return { isValid: false, body: "" }
  const body = await request.text()
  try {
    const isValid = nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, "hex"),
      Buffer.from(process.env.DISCORD_PUBLIC_KEY, "hex")
    )
    return { isValid, body }
  } catch {
    return { isValid: false, body: "" }
  }
}

function isExpired(raid) {
  if (raid.isMobaChul) return false
  if (!raid.date || !raid.time) return false
  const raidDateTime = new Date(`${raid.date}T${raid.time}:00+09:00`) // KST
  return new Date() > raidDateTime
}

const EXPIRED_MSG = { type: 4, data: { content: "⏰ 이미 기한이 지난 모집입니다.", flags: 64 } }

// ── 로아 API 캐릭터 조회 ──────────────────────────────────────────────────────
async function fetchLostarkCharacters(characterName) {
  const apiKey = process.env.LOSTARK_API_KEY
  const encoded = encodeURIComponent(characterName)
  const res = await fetch(
    `https://developer-lostark.game.onstove.com/characters/${encoded}/siblings`,
    {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
      },
    }
  )
  if (res.status === 404 || res.status === 204) return null
  if (!res.ok) throw new Error(`LoA API ${res.status}`)
  const data = await res.json()
  if (!data || data.length === 0) return null
  return data.map(c => ({
    name:   c.CharacterName,
    class:  c.CharacterClassName,
    level:  parseFloat(c.ItemAvgLevel.replace(/,/g, "")),
    server: c.ServerName,
  }))
}

// ── TrainRaid 출발 처리 ────────────────────────────────────────────────────────
async function launchTrainRaid(trainRaid) {
  const token = process.env.DISCORD_BOT_TOKEN
  const trainRaidId = trainRaid._id.toString()

  // 1. 음성채널 생성
  let voiceChannelId = null
  const guildId = trainRaid.guildId
  if (guildId) {
    try {
      const vcRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
        method: "POST",
        headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: `⚔️ ${trainRaid.trainLabel}`, type: 2, user_limit: trainRaid.maxPlayers }),
      })
      if (vcRes.ok) {
        const vcData = await vcRes.json()
        voiceChannelId = vcData.id
      }
    } catch (e) {
      console.error("기차 음성채널 생성 오류:", e.message)
    }
  }

  // 2. DM 발송
  const embed = buildTrainRaidLaunchEmbed(trainRaid)
  const recipients = [...new Set([trainRaid.hostId, ...trainRaid.participants.map(p => p.userId)])]
  for (const recipientId of recipients) {
    try {
      const isHost = recipientId === trainRaid.hostId
      await sendRaidDM(recipientId, embed, { voiceChannelId, guildId, isHost, raidId: trainRaidId })
    } catch (e) {
      console.error(`기차 출발 DM 실패 (${recipientId}):`, e.message)
    }
    await new Promise(r => setTimeout(r, 500))
  }

  // 3. DB 업데이트
  await Raid.findByIdAndUpdate(trainRaid._id, {
    status: "출발완료",
    dmSent: true,
    ...(voiceChannelId ? { voiceChannelId, voiceChannelCreatedAt: new Date() } : {}),
  })

  // 4. Discord 메시지 업데이트
  const updated = await Raid.findById(trainRaid._id)
  await updateTrainRaidDiscordMessage(updated)
}

// ── TrainRaid 참가 가능 캐릭터 필터링 ─────────────────────────────────────────
function filterEligibleCharactersForTrain(characters, role, trainRaid) {
  const minLevels = (trainRaid.trainRaids || []).map(r => (getMinLevel(r.raidAlias, r.difficulty) || getMinLevel(r.raidName, r.difficulty) || 0)).filter(l => l > 0)
  const maxMinLevel = minLevels.length > 0 ? Math.max(...minLevels) : 0

  let filtered = maxMinLevel > 0 ? characters.filter(c => c.level >= maxMinLevel) : [...characters]
  if (role === "support") filtered = filtered.filter(c => SUPPORTER_CLASSES.includes(c.class))
  return filtered
}

// ── 참가 가능 캐릭터 필터링 ────────────────────────────────────────────────────
function filterEligibleCharacters(characters, role, raid) {
  const minLevel = (getMinLevel(raid.raidAlias, raid.difficulty) || getMinLevel(raid.raidName, raid.difficulty) || 0)
  const dealers = raid.participants.filter(p => p.role === "dealer")

  // 최소 레벨 필터
  let filtered = characters.filter(c => c.level >= minLevel)

  // 서포터 버튼: 서포터 직업만 허용
  if (role === "support") {
    filtered = filtered.filter(c => SUPPORTER_CLASSES.includes(c.class))
  }

  // 4인 레이드 딜러: 중복 직업 차단
  if (role === "dealer" && raid.maxPlayers === 4) {
    const existingClasses = new Set(dealers.map(p => p.characterClass).filter(Boolean))
    filtered = filtered.filter(c => !existingClasses.has(c.class))
  }

  // 8인 레이드 딜러: 같은 직업 최대 2명
  if (role === "dealer" && raid.maxPlayers === 8) {
    const classCount = {}
    for (const p of dealers) {
      if (p.characterClass) classCount[p.characterClass] = (classCount[p.characterClass] || 0) + 1
    }
    filtered = filtered.filter(c => (classCount[c.class] || 0) < 2)
  }

  return filtered
}

// ── 캐릭터 선택 메뉴 응답 빌드 ────────────────────────────────────────────────
function buildCharSelectResponse(eligibleChars, role, raidId, minLevel) {
  if (eligibleChars.length === 0) {
    return Response.json({
      type: 4,
      data: { content: `❌ 이 레이드에 참가 가능한 캐릭터가 없습니다.\n(최소 레벨: ${minLevel}+)`, flags: 64 },
    })
  }

  const options = eligibleChars
    .sort((a, b) => b.level - a.level)
    .slice(0, 25)
    .map(c => ({
      label: c.name,
      description: c.combatPower
        ? `${c.class} · Lv.${c.level} · 전투력 ${c.combatPower.toLocaleString()}`
        : `${c.class} · Lv.${c.level} · ${c.server}`,
      value: `${c.name}||${c.class}||${c.level}||${c.combatPower ?? ""}`,
    }))

  return Response.json({
    type: 4,
    data: {
      flags: 64,
      content: "참가할 캐릭터를 선택하세요:",
      components: [{
        type: 1,
        components: [{
          type: 3, // STRING_SELECT
          custom_id: `select_char_${role}_${raidId}`,
          placeholder: "참가할 캐릭터를 선택하세요",
          options,
        }],
      }],
    },
  })
}

export async function POST(request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    if (checkRateLimit(ip)) {
      return new Response("Too Many Requests", { status: 429 })
    }

    const { isValid, body } = await verifyDiscordRequest(request)

    if (!isValid) {
      return new Response("Invalid signature", { status: 401 })
    }

    const interaction = JSON.parse(body)

    if (interaction.type === 1) {
      return Response.json({ type: 1 })
    }

    // ── 자동완성 ───────────────────────────────────────────────────────────
    if (interaction.type === 4) {
      await connectDB()
      const focusedOption = interaction.data.options?.find(o => o.focused)
      const commandName = interaction.data.name
      const userId = interaction.member?.user?.id || interaction.user?.id

      // /모집, /모바출모집 - 난이도 autocomplete
      if (
        (commandName === "모집" || commandName === "모바출모집") &&
        focusedOption?.name === "난이도"
      ) {
        const raidOption = interaction.data.options?.find(o => o.name === "레이드")?.value
        const DIFFICULTY_MAP = {
          "에키드나":   ["노말", "하드"],
          "에기르":     ["노말", "하드"],
          "아브렐슈드": ["노말", "하드", "익스트림 노말", "익스트림 하드", "나이트메어"],
          "모르둠":     ["노말", "하드"],
          "아르모체":   ["노말", "하드"],
          "카제로스":   ["노말", "하드"],
          "세르카":     ["노말", "하드", "나이트메어"],
          "지평의성당": ["1단계", "2단계", "3단계"],
        }
        const difficulties = DIFFICULTY_MAP[raidOption] || ["노말", "하드"]
        return Response.json({
          type: 8,
          data: { choices: difficulties.map(d => ({ name: d, value: d })) }
        })
      }

      // /모집, /모바출모집 캐릭터1~4 / /참가 캐릭터~캐릭터4 / /같이참가 내캐릭터1~4
      if (
        ((commandName === "모집" || commandName === "모바출모집") && focusedOption?.name?.startsWith("캐릭터")) ||
        (commandName === "참가" && (focusedOption?.name === "캐릭터" || focusedOption?.name?.startsWith("캐릭터"))) ||
        (commandName === "같이참가" && focusedOption?.name?.startsWith("내캐릭터"))
      ) {
        const userChars = await UserCharacters.findOne({ discordId: userId })
        if (!userChars) return Response.json({ type: 8, data: { choices: [] } })

        const userCharsObj = userChars.toObject()
        let allChars = []
        if (userCharsObj.accounts?.length > 0) {
          userCharsObj.accounts.forEach(acc =>
            (acc.characters || []).forEach(c => allChars.push(c))
          )
        } else {
          allChars = userCharsObj.characters || []
        }

        const query = focusedOption.value?.toLowerCase() || ""
        const filtered = allChars
          .filter(c => c.level > 0 && c.name.toLowerCase().includes(query))
          .sort((a, b) => b.level - a.level)
          .slice(0, 25)

        return Response.json({
          type: 8,
          data: {
            choices: filtered.map(c => ({
              name: `${c.name} (${c.class}) Lv.${c.level}`,
              value: c.name
            }))
          }
        })
      }

      // /같이참가 유저캐릭터1~4 autocomplete
      if (commandName === "같이참가" && focusedOption?.name?.startsWith("유저캐릭터")) {
        const targetUserIdForAc = interaction.data.options
          ?.find(o => o.name === "같이참가유저")?.value

        if (!targetUserIdForAc) {
          return Response.json({ type: 8, data: { choices: [] } })
        }

        const targetUserCharsAc = await UserCharacters.findOne({ discordId: targetUserIdForAc })
        if (!targetUserCharsAc) {
          return Response.json({ type: 8, data: { choices: [] } })
        }

        const targetCharsObjAc = targetUserCharsAc.toObject()
        let targetAllCharsAc = []
        if (targetCharsObjAc.accounts?.length > 0) {
          targetCharsObjAc.accounts.forEach(acc =>
            (acc.characters || []).forEach(c => targetAllCharsAc.push(c))
          )
        } else {
          targetAllCharsAc = targetCharsObjAc.characters || []
        }

        const queryAc = focusedOption.value?.toLowerCase() || ""
        const filteredAc = targetAllCharsAc
          .filter(c => c.level > 0 && c.name.toLowerCase().includes(queryAc))
          .sort((a, b) => b.level - a.level)
          .slice(0, 25)

        return Response.json({
          type: 8,
          data: {
            choices: filteredAc.map(c => ({
              name: `${c.name} (${c.class}) Lv.${c.level}`,
              value: c.name
            }))
          }
        })
      }

      return Response.json({ type: 8, data: { choices: [] } })
    }

    // ── 버튼 / 셀렉트 메뉴 ────────────────────────────────────────────────
    if (interaction.type === 3) {
      await connectDB()

      const customId = interaction.data.custom_id
      const userId = interaction.member?.user?.id || interaction.user?.id
      const userName = interaction.member?.user?.username || interaction.user?.username
      const userAvatar = interaction.member?.user?.avatar

      // ── 기차 레이드 패턴 (단일 레이드 패턴보다 먼저 매칭) ──────────────────
      const joinDealerTrainMatch  = customId.match(/^join_dealer_train_(.+)$/)
      const joinSupportTrainMatch = customId.match(/^join_support_train_(.+)$/)
      const leaveTrainMatch       = customId.match(/^leave_train_(.+)$/)
      const cancelRaidTrainMatch  = customId.match(/^cancel_raid_train_(.+)$/)
      const rosterTrainMatch      = customId.match(/^roster_train_(.+)$/)
      const startRaidTrainMatch   = customId.match(/^start_raid_train_(.+)$/)
      const selectCharTrainMatch  = customId.match(/^select_char_(dealer|support)_train_(.+)$/)
      const deleteVoiceTrainMatch = customId.match(/^delete_voice_train_(.+)$/)

      const joinDealerMatch  = customId.match(/^join_dealer_(?!train_)(.+)$/)
      const joinSupportMatch = customId.match(/^join_support_(?!train_)(.+)$/)
      const leaveMatch       = customId.match(/^leave_(?!train_)(.+)$/)
      const cancelRaidMatch  = customId.match(/^cancel_raid_(?!train_)(.+)$/)
      const rosterMatch      = customId.match(/^roster_(?!train_)(.+)$/)
      const deleteVoiceMatch = customId.match(/^delete_voice_(?!train_)(.+)$/)
      const selectCharMatch  = customId.match(/^select_char_(dealer|support)_(?!train_)(.+)$/)

      let content = "❌ 알 수 없는 오류가 발생했습니다."

      // ── 레이드 생성 플로우 ───────────────────────────────────────────────
      // 1단계: 모집 생성 시작 버튼
      if (customId === "raid_create_start") {
        const guildId = interaction.guild_id
        const channelId = interaction.channel_id

        const settings = await GuildSettings.findOne({ guildId })
        if (settings?.createChannelId && settings.createChannelId !== channelId) {
          return Response.json({
            type: 4,
            data: {
              flags: 64,
              content: `❌ 레이드 모집은 <#${settings.createChannelId}> 채널에서만 생성할 수 있습니다.`,
            }
          })
        }

        return Response.json({
          type: 4,
          data: {
            flags: 64,
            content: "레이드를 선택하세요:",
            components: [{
              type: 1,
              components: [{
                type: 3,
                custom_id: "raid_select_raid",
                placeholder: "레이드를 선택하세요",
                options: RAID_SELECT_OPTIONS,
              }]
            }]
          }
        })
      }

      // 2단계: 레이드 선택 → 난이도 선택
      if (customId === "raid_select_raid") {
        const raidValue = interaction.data.values[0]
        const raidInfo = RAID_DATA[raidValue]
        return Response.json({
          type: 7,
          data: {
            content: `**${raidInfo.raidAlias}** 난이도를 선택하세요:`,
            components: [{
              type: 1,
              components: [{
                type: 3,
                custom_id: `raid_select_diff_${raidValue}`,
                placeholder: "난이도 선택",
                options: raidInfo.difficulties.map(d => ({ label: d, value: d })),
              }]
            }]
          }
        })
      }

      // 3단계: 난이도 선택 → 날짜/시간 모달
      const diffSelectMatch = customId.match(/^raid_select_diff_([a-z]+)$/)
      if (diffSelectMatch) {
        const raidValue = diffSelectMatch[1]
        const difficulty = interaction.data.values[0]
        return Response.json({
          type: 9,
          data: {
            custom_id: `raid_submit_${raidValue}_${difficulty}`,
            title: "레이드 모집 정보 입력",
            components: [
              { type: 1, components: [{ type: 4, custom_id: "mobaChul", label: "모바출 여부 (y/n)", style: 1, placeholder: "y 또는 n", required: true, min_length: 1, max_length: 1 }] },
              { type: 1, components: [{ type: 4, custom_id: "date", label: "날짜 (YYYY-MM-DD)", style: 1, placeholder: "2026-04-01", required: false }] },
              { type: 1, components: [{ type: 4, custom_id: "time", label: "시간 (HH:MM)", style: 1, placeholder: "21:00", required: false }] },
              { type: 1, components: [{ type: 4, custom_id: "difficulty_level", label: "숙련도", style: 1, placeholder: "헤딩 / 트라이 / 클경 / 반숙 / 숙련 / 숙제", required: true, min_length: 2, max_length: 4 }] },
            ]
          }
        })
      }
      // ─────────────────────────────────────────────────────────────────────

      // ── [기차] 생성 플로우 ────────────────────────────────────────────────
      // 기차 Step 1: 기차 생성 시작 버튼
      if (customId === "train_create_start") {
        return Response.json({
          type: 4,
          data: {
            flags: 64,
            content: "배럭 레벨을 선택하세요:",
            components: [{
              type: 1,
              components: [{
                type: 3,
                custom_id: "train_select_level",
                placeholder: "배럭 레벨을 선택하세요",
                options: [
                  { label: "1680 - 노노하 3종",    value: "1680" },
                  { label: "1700 - 3종",           value: "1700" },
                  { label: "1710 - 3종/4종",        value: "1710" },
                  { label: "1720 - 3종/4종",        value: "1720" },
                  { label: "1730 - 3종/4종",        value: "1730" },
                  { label: "1750 - 3종/4종",        value: "1750" },
                ],
              }],
            }],
          },
        })
      }

      // 기차 Step 2: 레벨 선택 → 구성 선택 또는 모달 (1680 직행)
      if (customId === "train_select_level") {
        const level = interaction.data.values[0]
        const tierData = TRAIN_PRESETS[level]
        if (!tierData) {
          return Response.json({ type: 4, data: { content: "❌ 알 수 없는 레벨입니다.", flags: 64 } })
        }

        // 1680: 구성 1개 + 8인 고정 → 바로 모달
        if (level === "1680") {
          const preset = tierData.options[0]
          return Response.json({
            type: 9,
            data: {
              custom_id: `train_submit_1680_${preset.id}_8`,
              title: "기차 레이드 모집 정보 입력",
              components: [
                { type: 1, components: [{ type: 4, custom_id: "mobachul", label: "모바출 여부 (y/n)", style: 1, placeholder: "y 또는 n", required: true, min_length: 1, max_length: 1 }] },
                { type: 1, components: [{ type: 4, custom_id: "date", label: "날짜 (YYYY-MM-DD, 모바출이면 비워두세요)", style: 1, placeholder: "2026-04-10", required: false }] },
                { type: 1, components: [{ type: 4, custom_id: "time", label: "시간 (HH:MM, 모바출이면 비워두세요)", style: 1, placeholder: "21:00", required: false }] },
                { type: 1, components: [{ type: 4, custom_id: "difficulty_level", label: "숙련도", style: 1, placeholder: "헤딩 / 트라이 / 클경 / 반숙 / 숙련 / 숙제", required: true, min_length: 2, max_length: 4 }] },
              ],
            },
          })
        }

        // 그 외: 구성 선택 메뉴
        return Response.json({
          type: 7,
          data: {
            content: "기차 구성을 선택하세요:",
            components: [{
              type: 1,
              components: [{
                type: 3,
                custom_id: `train_select_preset_${level}`,
                placeholder: "기차 구성을 선택하세요",
                options: tierData.options.map(o => ({
                  label: o.label,
                  value: o.id,
                  description: o.raids.map(r => r.alias || r.raidAlias).join(" → "),
                })),
              }],
            }],
          },
        })
      }

      // 기차 Step 3: 구성 선택 → 인원 선택
      const trainPresetMatch = customId.match(/^train_select_preset_(\d+)$/)
      if (trainPresetMatch) {
        const level = trainPresetMatch[1]
        const presetId = interaction.data.values[0]
        return Response.json({
          type: 7,
          data: {
            content: "파티 인원을 선택하세요:",
            components: [{
              type: 1,
              components: [{
                type: 3,
                custom_id: `train_select_players_${level}_${presetId}`,
                placeholder: "인원 선택",
                options: [
                  { label: "4인 파티", value: "4" },
                  { label: "8인 파티", value: "8" },
                ],
              }],
            }],
          },
        })
      }

      // 기차 Step 4: 인원 선택 → 모달
      const trainPlayersMatch = customId.match(/^train_select_players_(\d+)_(.+)$/)
      if (trainPlayersMatch) {
        const level = trainPlayersMatch[1]
        const presetId = trainPlayersMatch[2]
        const maxPlayers = interaction.data.values[0]
        return Response.json({
          type: 9,
          data: {
            custom_id: `train_submit_${level}_${presetId}_${maxPlayers}`,
            title: "기차 레이드 모집 정보 입력",
            components: [
              { type: 1, components: [{ type: 4, custom_id: "mobachul", label: "모바출 여부 (y/n)", style: 1, placeholder: "y 또는 n", required: true, min_length: 1, max_length: 1 }] },
              { type: 1, components: [{ type: 4, custom_id: "date", label: "날짜 (YYYY-MM-DD, 모바출이면 비워두세요)", style: 1, placeholder: "2026-04-10", required: false }] },
              { type: 1, components: [{ type: 4, custom_id: "time", label: "시간 (HH:MM, 모바출이면 비워두세요)", style: 1, placeholder: "21:00", required: false }] },
              { type: 1, components: [{ type: 4, custom_id: "difficulty_level", label: "숙련도", style: 1, placeholder: "헤딩 / 트라이 / 클경 / 반숙 / 숙련 / 숙제", required: true, min_length: 2, max_length: 4 }] },
            ],
          },
        })
      }
      // ─────────────────────────────────────────────────────────────────────

      // ── [기차] 캐릭터 선택 → 기차 레이드 참가 ────────────────────────────
      if (selectCharTrainMatch) {
        const role         = selectCharTrainMatch[1]
        const trainRaidId  = selectCharTrainMatch[2]
        const selectedValue = interaction.data.values?.[0]
        if (!selectedValue) return Response.json({ type: 4, data: { content: "❌ 캐릭터를 선택해주세요.", flags: 64 } })

        const [characterName, characterClass, characterLevelStr, combatPowerStr] = selectedValue.split("||")
        const characterLevel = parseFloat(characterLevelStr)
        const characterCombatPower = combatPowerStr ? parseInt(combatPowerStr) : null

        const trainRaid = await Raid.findById(trainRaidId)
        if (!trainRaid || trainRaid.status !== "모집중") return Response.json({ type: 4, data: { content: "❌ 모집이 마감된 레이드입니다.", flags: 64 } })
        if (trainRaid.participants.some(p => p.userId === userId)) return Response.json({ type: 4, data: { content: "❌ 이미 참가 신청한 레이드입니다.", flags: 64 } })

        const supporterSlots = trainRaid.maxPlayers / 4
        const dealerSlots    = trainRaid.maxPlayers - supporterSlots
        const dealers    = trainRaid.participants.filter(p => p.role === "dealer")
        const supporters = trainRaid.participants.filter(p => p.role === "support")

        if (role === "dealer"  && dealers.length    >= dealerSlots)    return Response.json({ type: 4, data: { content: "❌ 딜러 자리가 꽉 찼습니다.",   flags: 64 } })
        if (role === "support" && supporters.length >= supporterSlots) return Response.json({ type: 4, data: { content: "❌ 서포터 자리가 꽉 찼습니다.", flags: 64 } })

        const userImage = userAvatar ? `https://cdn.discordapp.com/avatars/${userId}/${userAvatar}.png` : null
        trainRaid.participants.push({ userId, userName, userImage, role, characterName, characterClass, characterLevel, characterCombatPower })

        const newDealers    = trainRaid.participants.filter(p => p.role === "dealer")
        const newSupporters = trainRaid.participants.filter(p => p.role === "support")
        const isFull = newDealers.length >= dealerSlots && newSupporters.length >= supporterSlots
        const roleText = role === "dealer" ? "⚔️ 딜러" : "🛡️ 서포터"
        const charText = `\n캐릭터: ${characterClass} ${characterName} (Lv.${characterLevel})`

        if (isFull && trainRaid.isMobaChul) {
          await trainRaid.save()
          await launchTrainRaid(trainRaid)
          return Response.json({ type: 4, data: { content: `✅ **${userName}**님이 ${roleText}로 참가했습니다! 🚀 인원이 다 찼습니다. 출발합니다!${charText}`, flags: 64 } })
        } else {
          if (isFull) trainRaid.status = "모집완료"
          await trainRaid.save()
          await updateTrainRaidDiscordMessage(trainRaid)
          return Response.json({ type: 4, data: { content: `✅ **${userName}**님이 ${roleText}로 참가했습니다!${charText}`, flags: 64 } })
        }
      }

      // ── 캐릭터 선택 → 레이드 참가 처리 ──────────────────────────────────
      if (selectCharMatch) {
        const role   = selectCharMatch[1]
        const raidId = selectCharMatch[2]
        const selectedValue = interaction.data.values?.[0]

        if (!selectedValue) {
          return Response.json({ type: 4, data: { content: "❌ 캐릭터를 선택해주세요.", flags: 64 } })
        }

        const [characterName, characterClass, characterLevelStr, combatPowerStr] = selectedValue.split("||")
        const characterLevel = parseFloat(characterLevelStr)
        const characterCombatPower = combatPowerStr ? parseInt(combatPowerStr) : null

        const raid = await Raid.findById(raidId)
        if (!raid || raid.status !== "모집중") {
          return Response.json({ type: 4, data: { content: "❌ 모집이 마감된 레이드입니다.", flags: 64 } })
        }
        if (isExpired(raid)) return Response.json(EXPIRED_MSG)
        if (raid.participants.some(p => p.userId === userId)) {
          return Response.json({ type: 4, data: { content: "❌ 이미 참가 신청한 레이드입니다.", flags: 64 } })
        }

        const supporterSlots = raid.maxPlayers / 4
        const dealerSlots    = raid.maxPlayers - supporterSlots
        const dealers    = raid.participants.filter(p => p.role === "dealer")
        const supporters = raid.participants.filter(p => p.role === "support")

        if (role === "dealer"  && dealers.length    >= dealerSlots)    return Response.json({ type: 4, data: { content: "❌ 딜러 자리가 꽉 찼습니다.",   flags: 64 } })
        if (role === "support" && supporters.length >= supporterSlots) return Response.json({ type: 4, data: { content: "❌ 서포터 자리가 꽉 찼습니다.", flags: 64 } })

        const userImage = userAvatar ? `https://cdn.discordapp.com/avatars/${userId}/${userAvatar}.png` : null
        raid.participants.push({ userId, userName, userImage, role, characterName, characterClass, characterLevel, characterCombatPower })

        const newDealers    = raid.participants.filter(p => p.role === "dealer")
        const newSupporters = raid.participants.filter(p => p.role === "support")
        const isFull = newDealers.length >= dealerSlots && newSupporters.length >= supporterSlots
        const roleText = role === "dealer" ? "⚔️ 딜러" : "🛡️ 서포터"
        const charText = `\n캐릭터: ${characterClass} ${characterName} (Lv.${characterLevel})`

        if (isFull && raid.isMobaChul) {
          await raid.save()
          await launchRaid(raid)
          return Response.json({ type: 4, data: { content: `✅ **${userName}**님이 ${roleText}로 참가했습니다! 🚀 인원이 다 찼습니다. 출발합니다!${charText}`, flags: 64 } })
        } else {
          if (isFull) raid.status = "모집완료"
          await raid.save()
          await updateMessage(raid)
          return Response.json({ type: 4, data: { content: `✅ **${userName}**님이 ${roleText}로 참가했습니다!${charText}`, flags: 64 } })
        }
      }

      // ── [기차] 딜러/서포터 참가 버튼 → 캐릭터 확인 ──────────────────────
      if (joinDealerTrainMatch || joinSupportTrainMatch) {
        const trainRaidId = joinDealerTrainMatch ? joinDealerTrainMatch[1] : joinSupportTrainMatch[1]
        const role        = joinDealerTrainMatch ? "dealer" : "support"
        const trainRaid   = await Raid.findById(trainRaidId)

        if (!trainRaid || trainRaid.status !== "모집중") {
          content = "❌ 모집이 마감된 레이드입니다."
        } else if (trainRaid.participants.some(p => p.userId === userId)) {
          content = "❌ 이미 참가 신청한 레이드입니다."
        } else {
          const supporterSlots = trainRaid.maxPlayers / 4
          const dealerSlots    = trainRaid.maxPlayers - supporterSlots
          const dealers    = trainRaid.participants.filter(p => p.role === "dealer")
          const supporters = trainRaid.participants.filter(p => p.role === "support")

          if (role === "dealer" && dealers.length >= dealerSlots) {
            content = "❌ 딜러 자리가 꽉 찼습니다."
          } else if (role === "support" && supporters.length >= supporterSlots) {
            content = "❌ 서포터 자리가 꽉 찼습니다."
          } else {
            const userChars = await UserCharacters.findOne({ discordId: userId })
            if (!userChars || userChars.characters.length === 0) {
              return Response.json({
                type: 9,
                data: {
                  custom_id: `char_verify_${role}_train_${trainRaidId}`,
                  title: "캐릭터 연동",
                  components: [{ type: 1, components: [{ type: 4, custom_id: "character_name", label: "대표 캐릭터명을 입력하세요", placeholder: "캐릭터명 입력", style: 1, required: true }] }],
                },
              })
            }
            const eligibleChars = filterEligibleCharactersForTrain(userChars.characters, role, trainRaid)
            const minLevels = (trainRaid.trainRaids || []).map(r => getMinLevel(r.raidAlias, r.difficulty)).filter(l => l > 0)
            const maxMinLevel = minLevels.length > 0 ? Math.max(...minLevels) : 0
            return buildCharSelectResponse(eligibleChars, role, `train_${trainRaidId}`, maxMinLevel)
          }
        }
      }

      // ── [기차] 참가 취소 ──────────────────────────────────────────────────
      if (leaveTrainMatch) {
        const trainRaidId = leaveTrainMatch[1]
        const trainRaid = await Raid.findById(trainRaidId)
        if (!trainRaid) {
          content = "❌ 레이드를 찾을 수 없습니다."
        } else {
          const idx = trainRaid.participants.findIndex(p => p.userId === userId)
          if (idx === -1) {
            content = "❌ 참가 신청하지 않은 레이드입니다."
          } else {
            trainRaid.participants.splice(idx, 1)
            if (trainRaid.status === "모집완료") trainRaid.status = "모집중"
            await trainRaid.save()
            await updateTrainRaidDiscordMessage(trainRaid)
            content = `✅ **${userName}**님의 참가가 취소되었습니다.`
          }
        }
      }

      // ── [기차] 모집 취소 → 모달 ────────────────────────────────────────────
      if (cancelRaidTrainMatch) {
        const trainRaidId = cancelRaidTrainMatch[1]
        return Response.json({
          type: 9,
          data: {
            custom_id: `cancel_confirm_train_${trainRaidId}`,
            title: "모집 취소 확인",
            components: [{ type: 1, components: [{ type: 4, custom_id: "confirm_text", label: "정말 취소하시겠어요? '취소' 라고 입력하세요", style: 1, placeholder: "취소", required: true, min_length: 2, max_length: 2 }] }],
          },
        })
      }

      // ── [기차] 출발 (주최자 전용) ─────────────────────────────────────────
      if (startRaidTrainMatch) {
        const trainRaidId = startRaidTrainMatch[1]
        const trainRaid = await Raid.findById(trainRaidId)
        if (!trainRaid) {
          content = "❌ 레이드를 찾을 수 없습니다."
        } else if (!trainRaid.isMobaChul) {
          content = "❌ 모바출 레이드에서만 사용할 수 있습니다."
        } else if (trainRaid.hostId !== userId) {
          content = "❌ 주최자만 출발할 수 있습니다."
        } else if (trainRaid.status === "출발완료") {
          content = "❌ 이미 출발한 레이드입니다."
        } else if (trainRaid.status === "취소") {
          content = "❌ 취소된 레이드입니다."
        } else {
          await launchTrainRaid(trainRaid)
          content = `✅ ${trainRaid.trainLabel} 출발 완료! 참가자들에게 DM을 발송했습니다.`
        }
      }

      // ── [기차] 참가자 명단 ──────────────────────────────────────────────────
      if (rosterTrainMatch) {
        const trainRaidId = rosterTrainMatch[1]
        const trainRaid = await Raid.findById(trainRaidId)
        if (!trainRaid) {
          content = "❌ 레이드를 찾을 수 없습니다."
        } else {
          const dealers    = trainRaid.participants.filter(p => p.role === "dealer")
          const supporters = trainRaid.participants.filter(p => p.role === "support")
          const supporterSlots = trainRaid.maxPlayers / 4
          const dealerSlots    = trainRaid.maxPlayers - supporterSlots

          const dealerList = dealers.length > 0
            ? dealers.map((p, i) => { const c = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}` : ""; return `${i + 1}. ⚔️ ${p.userName}${c}` }).join("\n")
            : "없음"
          const supporterList = supporters.length > 0
            ? supporters.map((p, i) => { const c = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}` : ""; return `${i + 1}. 🛡️ ${p.userName}${c}` }).join("\n")
            : "없음"

          const compLine = trainRaid.trainRaids?.length > 0
            ? `\n\n**레이드 구성**\n${trainRaid.trainRaids.sort((a, b) => a.order - b.order).map((r, i) => `${i + 1}. (${r.raidTag}) ${r.raidAlias} ${r.difficulty}`).join("\n")}`
            : ""

          content = `📋 **${trainRaid.trainLabel} 참가자 명단** (${trainRaid.participants.length}/${trainRaid.maxPlayers}명)${compLine}\n\n**딜러 (${dealers.length}/${dealerSlots})**\n${dealerList}\n\n**서포터 (${supporters.length}/${supporterSlots})**\n${supporterList}`
        }
      }

      // ── [기차] 음성채널 수동 삭제 ─────────────────────────────────────────
      if (deleteVoiceTrainMatch) {
        const trainRaidId = deleteVoiceTrainMatch[1]
        const trainRaid = await Raid.findById(trainRaidId)
        if (!trainRaid) {
          content = "❌ 레이드를 찾을 수 없습니다."
        } else if (trainRaid.hostId !== userId) {
          content = "❌ 주최자만 음성채널을 삭제할 수 있습니다."
        } else if (!trainRaid.voiceChannelId) {
          content = "❌ 삭제할 음성채널이 없습니다."
        } else {
          const token = process.env.DISCORD_BOT_TOKEN
          try {
            const delRes = await fetch(`${DISCORD_API}/channels/${trainRaid.voiceChannelId}`, { method: "DELETE", headers: { Authorization: `Bot ${token}` } })
            if (delRes.ok || delRes.status === 404) {
              await Raid.findByIdAndUpdate(trainRaidId, { voiceChannelId: null, voiceChannelCreatedAt: null })
              content = "✅ 음성채널이 삭제되었습니다."
            } else {
              content = "❌ 음성채널 삭제에 실패했습니다."
            }
          } catch (e) {
            content = "❌ 음성채널 삭제 중 오류가 발생했습니다."
          }
        }
      }

      // ── 딜러/서포터 참가 버튼 → 캐릭터 확인 ─────────────────────────────
      if (joinDealerMatch || joinSupportMatch) {
        const raidId = joinDealerMatch ? joinDealerMatch[1] : joinSupportMatch[1]
        const role   = joinDealerMatch ? "dealer" : "support"
        const raid   = await Raid.findById(raidId)

        if (!raid || raid.status !== "모집중") {
          content = "❌ 모집이 마감된 레이드입니다."
        } else if (isExpired(raid)) {
          return Response.json(EXPIRED_MSG)
        } else if (raid.participants.some(p => p.userId === userId)) {
          content = "❌ 이미 참가 신청한 레이드입니다."
        } else {
          const supporterSlots = raid.maxPlayers / 4
          const dealerSlots    = raid.maxPlayers - supporterSlots
          const dealers    = raid.participants.filter(p => p.role === "dealer")
          const supporters = raid.participants.filter(p => p.role === "support")

          if (role === "dealer" && dealers.length >= dealerSlots) {
            content = "❌ 딜러 자리가 꽉 찼습니다."
          } else if (role === "support" && supporters.length >= supporterSlots) {
            content = "❌ 서포터 자리가 꽉 찼습니다."
          } else {
            // 슬롯 여유 있음 → 캐릭터 확인
            const userChars = await UserCharacters.findOne({ discordId: userId })

            if (!userChars || userChars.characters.length === 0) {
              // 미연동 → 캐릭터명 입력 모달
              return Response.json({
                type: 9,
                data: {
                  custom_id: `char_verify_${role}_${raidId}`,
                  title: "캐릭터 연동",
                  components: [{
                    type: 1,
                    components: [{
                      type: 4,
                      custom_id: "character_name",
                      label: "대표 캐릭터명을 입력하세요",
                      placeholder: "캐릭터명 입력",
                      style: 1,
                      required: true,
                    }],
                  }],
                },
              })
            }

            // 연동됨 → 참가 가능 캐릭터 필터 후 선택 메뉴
            const eligibleChars = filterEligibleCharacters(userChars.characters, role, raid)
            const minLevel = getMinLevel(raid.raidAlias, raid.difficulty)
            return buildCharSelectResponse(eligibleChars, role, raidId, minLevel)
          }
        }
      }

      // ── 참가 취소 ──────────────────────────────────────────────────────────
      if (leaveMatch) {
        const raidId = leaveMatch[1]
        const raid = await Raid.findById(raidId)

        if (!raid) {
          content = "❌ 레이드를 찾을 수 없습니다."
        } else if (isExpired(raid)) {
          return Response.json(EXPIRED_MSG)
        } else if (raid.totalRounds >= 2) {
          let found = false
          for (const round of raid.rounds) {
            const idx = round.participants.findIndex(p => p.userId === userId)
            if (idx !== -1) {
              round.participants.splice(idx, 1)
              found = true
            }
          }
          if (!found) {
            content = "❌ 참가 신청하지 않은 레이드입니다."
          } else {
            if (raid.status === "모집완료") raid.status = "모집중"
            raid.markModified('rounds')
            await raid.save()
            await updateMessage(raid)
            content = `✅ **${userName}**님의 참가가 취소되었습니다.`
          }
        } else {
          const participantIndex = raid.participants.findIndex(p => p.userId === userId)
          if (participantIndex === -1) {
            content = "❌ 참가 신청하지 않은 레이드입니다."
          } else {
            raid.participants.splice(participantIndex, 1)
            if (raid.status === "모집완료") raid.status = "모집중"
            await raid.save()
            await updateMessage(raid)
            content = `✅ **${userName}**님의 참가가 취소되었습니다.`
          }
        }
      }

      // ── 모집 취소 (주최자만) → 모달 ──────────────────────────────────────
      if (cancelRaidMatch) {
        const raidId = cancelRaidMatch[1]
        return Response.json({
          type: 9,
          data: {
            custom_id: `cancel_confirm_${raidId}`,
            title: "모집 취소 확인",
            components: [{
              type: 1,
              components: [{
                type: 4,
                custom_id: "confirm_text",
                label: "정말 취소하시겠어요? '취소' 라고 입력하세요",
                style: 1,
                placeholder: "취소",
                required: true,
                min_length: 2,
                max_length: 2,
              }]
            }]
          }
        })
      }

      // ── 출발 (주최자 전용, 모바출 레이드만) ──────────────────────────────
      const departMatch = customId.match(/^depart_raid_(.+)$/)
      if (departMatch) {
        const raidId = departMatch[1]
        const raid = await Raid.findById(raidId)

        if (!raid) {
          content = "❌ 레이드를 찾을 수 없습니다."
        } else if (isExpired(raid)) {
          return Response.json(EXPIRED_MSG)
        } else if (!raid.isMobaChul) {
          content = "❌ 모바출 레이드에서만 사용할 수 있습니다."
        } else if (raid.hostId !== userId) {
          content = "❌ 주최자만 출발할 수 있습니다."
        } else if (raid.status === "출발완료") {
          content = "❌ 이미 출발한 레이드입니다."
        } else if (raid.status === "취소") {
          content = "❌ 취소된 레이드입니다."
        } else {
          await launchRaid(raid)
          const deptLabel = raid.isTrain ? `✅ ${raid.trainLabel} 출발 완료!` : "✅ 출발 완료!"
          content = `${deptLabel} 참가자들에게 DM을 발송했습니다.`
        }
      }

      // ── 참가자 명단 ────────────────────────────────────────────────────────
      if (rosterMatch) {
        const raidId = rosterMatch[1]
        const raid = await Raid.findById(raidId)

        if (!raid) {
          content = "❌ 레이드를 찾을 수 없습니다."
        } else if (raid.totalRounds >= 2) {
          // N수 포맷
          const supporterSlots = raid.maxPlayers / 4
          const dealerSlots = raid.maxPlayers - supporterSlots
          let totalParticipants = 0
          const roundTexts = (raid.rounds || []).sort((a, b) => a.order - b.order).map(r => {
            const d = r.participants.filter(p => p.role === "dealer")
            const s = r.participants.filter(p => p.role === "support")
            totalParticipants += d.length + s.length
            const dText = d.length > 0
              ? d.map((p, i) => { const c = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}` : ""; return `${i + 1}. ⚔️ ${p.userName}${c}` }).join("\n")
              : "없음"
            const sText = s.length > 0
              ? s.map((p, i) => { const c = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}` : ""; return `${i + 1}. 🛡️ ${p.userName}${c}` }).join("\n")
              : "없음"
            return `━━ ${r.order}수 ━━\n딜러 (${d.length}/${dealerSlots}): ${dText}\n서포터 (${s.length}/${supporterSlots}): ${sText}`
          })
          content = `📋 **${raid.raidAlias} ${raid.difficulty} ${raid.totalRounds}수 참가자 명단** (${totalParticipants}/${raid.maxPlayers * raid.totalRounds}명)\n\n${roundTexts.join("\n\n")}`
        } else {
          const dealers    = raid.participants.filter(p => p.role === "dealer")
          const supporters = raid.participants.filter(p => p.role === "support")
          const supporterSlots = raid.maxPlayers / 4
          const dealerSlots    = raid.maxPlayers - supporterSlots

          const dealerList = dealers.length > 0
            ? dealers.map((p, i) => {
                const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}` : ""
                return `${i + 1}. ⚔️ ${p.userName}${charInfo}`
              }).join("\n")
            : "없음"
          const supporterList = supporters.length > 0
            ? supporters.map((p, i) => {
                const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}` : ""
                return `${i + 1}. 🛡️ ${p.userName}${charInfo}`
              }).join("\n")
            : "없음"

          const title = raid.isTrain ? (raid.trainLabel || "기차 레이드") : `${raid.raidAlias} ${raid.difficulty}`
          const compLine = raid.isTrain && raid.trainRaids?.length > 0
            ? `\n\n**레이드 구성**\n${raid.trainRaids.sort((a, b) => a.order - b.order).map((r, i) => `${i + 1}. (${r.raidTag}) ${r.raidAlias} ${r.difficulty}`).join("\n")}`
            : ""
          content = `📋 **${title} 참가자 명단** (${raid.participants.length}/${raid.maxPlayers}명)${compLine}\n\n**딜러 (${dealers.length}/${dealerSlots})**\n${dealerList}\n\n**서포터 (${supporters.length}/${supporterSlots})**\n${supporterList}`
        }
      }

      // ── 음성채널 수동 삭제 (주최자 전용) ─────────────────────────────────
      if (deleteVoiceMatch) {
        const raidId = deleteVoiceMatch[1]
        const raid = await Raid.findById(raidId).catch(() => null)

        if (!raid) {
          content = "❌ 레이드를 찾을 수 없습니다."
        } else if (raid.hostId !== userId) {
          content = "❌ 주최자만 음성채널을 삭제할 수 있습니다."
        } else if (!raid.voiceChannelId) {
          content = "❌ 삭제할 음성채널이 없습니다."
        } else {
          const token = process.env.DISCORD_BOT_TOKEN
          try {
            const delRes = await fetch(`${DISCORD_API}/channels/${raid.voiceChannelId}`, {
              method: "DELETE",
              headers: { Authorization: `Bot ${token}` },
            })
            if (delRes.ok || delRes.status === 404) {
              await Raid.findByIdAndUpdate(raidId, { voiceChannelId: null, voiceChannelCreatedAt: null })
              content = "✅ 음성채널이 삭제되었습니다."
            } else {
              const errData = await delRes.json().catch(() => ({}))
              content = `❌ 음성채널 삭제에 실패했습니다. (${errData.message || delRes.status})`
            }
          } catch (e) {
            content = "❌ 음성채널 삭제 중 오류가 발생했습니다."
          }
        }
      }

      // ── N수 레이드 참가 버튼 ──────────────────────────────────────────────
      const joinNsuMatch = customId.match(/^join_nsu_(.+)$/)
      if (joinNsuMatch) {
        const raidId = joinNsuMatch[1]
        const raid = await Raid.findById(raidId)
        if (!raid || raid.totalRounds < 2) {
          content = "❌ N수 레이드를 찾을 수 없습니다."
        } else if (raid.status !== "모집중") {
          content = "❌ 모집이 마감된 레이드입니다."
        } else {
          const alreadyIn = raid.rounds.some(r => r.participants.some(p => p.userId === userId))
          if (alreadyIn) {
            content = "❌ 이미 참가 신청한 레이드입니다."
          } else {
            const userChars = await UserCharacters.findOne({ discordId: userId })
            if (!userChars || ((!userChars.accounts || userChars.accounts.length === 0) && userChars.characters.length === 0)) {
              return Response.json({
                type: 9,
                data: {
                  custom_id: `char_verify_nsu_${raidId}`,
                  title: "캐릭터 연동",
                  components: [{ type: 1, components: [{ type: 4, custom_id: "character_name", label: "대표 캐릭터명을 입력하세요", placeholder: "캐릭터명 입력", style: 1, required: true }] }],
                },
              })
            }

            const minLevel = (getMinLevel(raid.raidAlias, raid.difficulty) || getMinLevel(raid.raidName, raid.difficulty) || 0)
            const userCharsObj = userChars.toObject()
            let allChars = []
            if (userCharsObj.accounts && userCharsObj.accounts.length > 0) {
              userCharsObj.accounts.forEach(acc =>
                (acc.characters || []).forEach(c =>
                  allChars.push({ ...c, accountIndex: acc.accountIndex })
                )
              )
            }
            if (allChars.length === 0) {
              allChars = (userCharsObj.characters || []).map(c => ({ ...c, accountIndex: 1 }))
            }
            const eligible = allChars.filter(c => !minLevel || c.level >= minLevel)

            if (eligible.length === 0) {
              return Response.json({ type: 4, data: { content: `❌ 이 레이드에 참가 가능한 캐릭터가 없습니다.\n(최소 레벨: ${minLevel}+)`, flags: 64 } })
            }

            const options = eligible.sort((a, b) => b.level - a.level).slice(0, 25).map(c => ({
              label: c.name,
              description: `${c.class} · Lv.${c.level} · [계정${c.accountIndex}]`,
              value: `${c.name}||${c.class}||${c.level}||${c.combatPower ?? ""}`,
            }))

            await NsuSession.findOneAndUpdate(
              { userId, raidId },
              { $set: { selections: new Map(), createdAt: new Date() } },
              { upsert: true, new: true }
            )

            const selectRows = Array.from({ length: raid.totalRounds }, (_, i) => ({
              type: 1,
              components: [{
                type: 3,
                custom_id: `select_nsu_char_${i + 1}_${raidId}`,
                placeholder: `${i + 1}수 캐릭터 선택`,
                options,
              }],
            }))

            return Response.json({
              type: 4,
              data: {
                flags: 64,
                content: `**${raid.raidAlias} ${raid.difficulty} ${raid.totalRounds}수** 각 수별 참가할 캐릭터를 선택하세요:`,
                components: selectRows,
              },
            })
          }
        }
      }

      // ── N수 캐릭터 선택 → 세션 저장 / 전체 선택 완료 시 참가 처리 ─────────
      const selectNsuCharMatch = customId.match(/^select_nsu_char_(\d+)_(.+)$/)
      if (selectNsuCharMatch) {
        const order = parseInt(selectNsuCharMatch[1])
        const raidId = selectNsuCharMatch[2]
        const selectedValue = interaction.data.values?.[0]
        if (!selectedValue) return Response.json({ type: 4, data: { content: "❌ 캐릭터를 선택해주세요.", flags: 64 } })

        const raid = await Raid.findById(raidId)
        if (!raid || raid.totalRounds < 2) return Response.json({ type: 4, data: { content: "❌ 레이드를 찾을 수 없습니다.", flags: 64 } })
        if (raid.status !== "모집중") return Response.json({ type: 4, data: { content: "❌ 모집이 마감된 레이드입니다.", flags: 64 } })

        const existingSession = await NsuSession.findOne({ userId, raidId })
        if (!existingSession) return Response.json({ type: 4, data: { content: "❌ 세션이 만료되었습니다. 다시 참가 버튼을 눌러주세요.", flags: 64 } })

        const newCharName = selectedValue.split("||")[0]
        for (const [key, val] of existingSession.selections.entries()) {
          if (parseInt(key) !== order && val.split("||")[0] === newCharName) {
            return Response.json({ type: 4, data: { content: "❌ 같은 캐릭터를 여러 수에 배치할 수 없습니다.", flags: 64 } })
          }
        }

        const nsuSession = await NsuSession.findOneAndUpdate(
          { userId, raidId },
          { $set: { [`selections.${order}`]: selectedValue } },
          { new: true }
        )
        if (!nsuSession) return Response.json({ type: 4, data: { content: "❌ 세션이 만료되었습니다. 다시 참가 버튼을 눌러주세요.", flags: 64 } })

        const selectedCount = nsuSession.selections ? nsuSession.selections.size : 0
        if (selectedCount < raid.totalRounds) {
          const remaining = raid.totalRounds - selectedCount
          return Response.json({ type: 4, data: { content: `✅ ${order}수 선택 완료! 나머지 ${remaining}수도 선택해주세요.`, flags: 64 } })
        }

        // 전체 선택 완료 → 참가 처리
        const supporterSlots = raid.maxPlayers / 4
        const dealerSlots = raid.maxPlayers - supporterSlots
        const userImage = userAvatar ? `https://cdn.discordapp.com/avatars/${userId}/${userAvatar}.png` : null

        const alreadyIn = raid.rounds.some(r => r.participants.some(p => p.userId === userId))
        if (alreadyIn) {
          await NsuSession.deleteOne({ userId, raidId })
          return Response.json({ type: 4, data: { content: "❌ 이미 참가 신청한 레이드입니다.", flags: 64 } })
        }

        for (const [orderKey, val] of nsuSession.selections.entries()) {
          const roundOrder = parseInt(orderKey)
          const [characterName, characterClass, characterLevelStr, combatPowerStr] = val.split("||")
          const characterLevel = parseFloat(characterLevelStr)
          const characterCombatPower = combatPowerStr ? parseInt(combatPowerStr) : null
          const role = SUPPORTER_CLASSES.includes(characterClass) ? "support" : "dealer"

          const round = raid.rounds.find(r => r.order === roundOrder)
          if (!round) continue

          const roundDealers = round.participants.filter(p => p.role === "dealer")
          const roundSupporters = round.participants.filter(p => p.role === "support")
          if (role === "dealer" && roundDealers.length >= dealerSlots) {
            await NsuSession.deleteOne({ userId, raidId })
            return Response.json({ type: 4, data: { content: `❌ ${roundOrder}수 딜러 자리가 꽉 찼습니다.`, flags: 64 } })
          }
          if (role === "support" && roundSupporters.length >= supporterSlots) {
            await NsuSession.deleteOne({ userId, raidId })
            return Response.json({ type: 4, data: { content: `❌ ${roundOrder}수 서포터 자리가 꽉 찼습니다.`, flags: 64 } })
          }

          round.participants.push({ userId, userName, userImage, role, characterName, characterClass, characterLevel, characterCombatPower })
        }

        const allFull = raid.rounds.every(r => {
          const d = r.participants.filter(p => p.role === "dealer").length
          const s = r.participants.filter(p => p.role === "support").length
          return d >= dealerSlots && s >= supporterSlots
        })
        if (allFull) raid.status = "모집완료"

        raid.markModified('rounds')
        await raid.save()
        await NsuSession.deleteOne({ userId, raidId })

        const response = Response.json({ type: 4, data: { content: `✅ **${userName}**님이 ${raid.totalRounds}수 레이드에 참가했습니다!`, flags: 64 } })
        const updatedRaid = await Raid.findById(raidId)
        if (updatedRaid) after(async () => { await updateDiscordMessage(updatedRaid) })

        return response
      }

      // ── 캐릭터 인증 버튼 (char_auth_register / char_auth_update / char_auth_remove) ──
      if (customId === "char_auth_register") {
        return Response.json({
          type: 9,
          data: {
            custom_id: "char_auth_modal_register",
            title: "캐릭터 인증",
            components: [
              { type: 1, components: [{ type: 4, custom_id: "char_1", label: "계정 1 대표 캐릭터명 (필수)", placeholder: "캐릭터명 입력 (예: 홍길동)", style: 1, required: true }] },
              { type: 1, components: [{ type: 4, custom_id: "char_2", label: "계정 2 대표 캐릭터명 (선택)", placeholder: "캐릭터명 입력", style: 1, required: false }] },
              { type: 1, components: [{ type: 4, custom_id: "char_3", label: "계정 3 대표 캐릭터명 (선택)", placeholder: "캐릭터명 입력", style: 1, required: false }] },
              { type: 1, components: [{ type: 4, custom_id: "char_4", label: "계정 4 대표 캐릭터명 (선택)", placeholder: "캐릭터명 입력", style: 1, required: false }] },
            ],
          },
        })
      }

      if (customId === "char_auth_update") {
        const existing = await UserCharacters.findOne({ discordId: userId })
        if (!existing?.representCharacter && (!existing?.accounts || existing.accounts.length === 0)) {
          return Response.json({ type: 4, data: { content: "❌ 등록된 캐릭터가 없습니다. 먼저 인증해주세요.", flags: 64 } })
        }
        const getPlaceholder = (idx) => {
          if (existing?.accounts?.length > 0) {
            const acc = existing.accounts.find(a => a.accountIndex === idx)
            return acc ? `현재: ${acc.representCharacter}` : "미등록"
          }
          if (idx === 1 && existing?.representCharacter) return `현재: ${existing.representCharacter}`
          return "미등록"
        }
        return Response.json({
          type: 9,
          data: {
            custom_id: "char_auth_modal_update",
            title: "캐릭터 변경",
            components: [
              { type: 1, components: [{ type: 4, custom_id: "char_1", label: "계정 1 대표 캐릭터명 (필수)", placeholder: getPlaceholder(1), style: 1, required: false }] },
              { type: 1, components: [{ type: 4, custom_id: "char_2", label: "계정 2 대표 캐릭터명 (선택)", placeholder: getPlaceholder(2), style: 1, required: false }] },
              { type: 1, components: [{ type: 4, custom_id: "char_3", label: "계정 3 대표 캐릭터명 (선택)", placeholder: getPlaceholder(3), style: 1, required: false }] },
              { type: 1, components: [{ type: 4, custom_id: "char_4", label: "계정 4 대표 캐릭터명 (선택)", placeholder: getPlaceholder(4), style: 1, required: false }] },
            ],
          },
        })
      }

      // ── 계정 선택 핸들러 (레거시, 더 이상 사용되지 않음) ──────────────────
      if (customId === "char_auth_select_account") {
        return Response.json({ type: 4, data: { content: "❌ 캐릭터 변경은 변경 버튼을 다시 눌러주세요.", flags: 64 } })
      }

      if (customId === "char_auth_remove") {
        const existing = await UserCharacters.findOne({ discordId: userId })
        if (!existing?.representCharacter) {
          return Response.json({ type: 4, data: { content: "❌ 등록된 캐릭터가 없습니다.", flags: 64 } })
        }
        return Response.json({
          type: 9,
          data: {
            custom_id: "char_auth_modal_remove",
            title: "인증 제거",
            components: [{
              type: 1,
              components: [{
                type: 4,
                custom_id: "confirm_text",
                label: "'삭제' 라고 입력하면 캐릭터 정보가 제거됩니다",
                placeholder: "삭제",
                style: 1,
                required: true,
              }],
            }],
          },
        })
      }

      return Response.json({
        type: 4,
        data: { content, flags: 64 }
      })
    }

    // ── 슬래시 커맨드 ─────────────────────────────────────────────────────
    if (interaction.type === 2) {
      await connectDB()
      const commandName = interaction.data.name
      const userId = interaction.member?.user?.id || interaction.user?.id
      const guildId = interaction.guild_id

      // /지난레이드삭제
      if (commandName === "지난레이드삭제") {
        const now = new Date()
        const memberPermissions = BigInt(interaction.member?.permissions || "0")
        const isAdmin = (memberPermissions & BigInt(0x8)) === BigInt(0x8)

        const query = { guildId }
        if (!isAdmin) query.hostId = userId

        const raids = await Raid.find(query)
        const targetRaids = raids.filter(r => {
          if (r.status === "취소" || r.status === "출발완료") return true
          if (!r.isMobaChul && r.date && r.time) {
            const raidDateTime = new Date(`${r.date}T${r.time}:00+09:00`)
            return now > raidDateTime
          }
          return false
        })

        if (targetRaids.length === 0) {
          return Response.json({
            type: 4,
            data: { content: "❌ 삭제할 레이드가 없습니다.", flags: 64 }
          })
        }

        const scopeText = isAdmin ? "서버 전체" : "내가 주최한"
        const response = Response.json({
          type: 4,
          data: {
            content: `✅ ${scopeText} 지난/종료 레이드 ${targetRaids.length}개를 삭제합니다...`,
            flags: 64
          }
        })

        const token = process.env.DISCORD_BOT_TOKEN
        Promise.all(
          targetRaids.map(async (raid) => {
            try {
              if (raid.discordMessageId && raid.discordChannelId) {
                await fetch(
                  `${DISCORD_API}/channels/${raid.discordChannelId}/messages/${raid.discordMessageId}`,
                  { method: "DELETE", headers: { Authorization: `Bot ${token}` } }
                )
              }
              await Raid.findByIdAndUpdate(raid._id, { status: "취소" })
            } catch (e) {
              console.error("레이드 삭제 오류:", e.message)
            }
          })
        ).catch(e => console.error("지난레이드삭제 백그라운드 오류:", e.message))

        return response
      }

      // /모집
      if (commandName === "모집" || commandName === "모바출모집") {
        const options = interaction.data.options || []
        const raidAlias       = options.find(o => o.name === "레이드")?.value
        const difficulty      = options.find(o => o.name === "난이도")?.value
        const difficultyLevel = options.find(o => o.name === "숙련도")?.value
        const totalRounds     = options.find(o => o.name === "n수")?.value || 1
        const char1 = options.find(o => o.name === "캐릭터1")?.value?.trim() || null
        const char2 = options.find(o => o.name === "캐릭터2")?.value?.trim() || null
        const char3 = options.find(o => o.name === "캐릭터3")?.value?.trim() || null
        const char4 = options.find(o => o.name === "캐릭터4")?.value?.trim() || null
        const userName = interaction.member?.user?.username || interaction.user?.username

        const isMobaChul = commandName === "모바출모집"
        const dateInput = isMobaChul ? "" : (options.find(o => o.name === "날짜")?.value || "").trim()
        const timeInput = isMobaChul ? "" : (options.find(o => o.name === "시간")?.value || "").trim()

        const ALIAS_TO_KEY = {
          "에키드나":   "ekidna",
          "에기르":     "aegir",
          "아브렐슈드": "abrelshud",
          "모르둠":     "mordoom",
          "아르모체":   "armoche",
          "카제로스":   "kazeros",
          "세르카":     "serka",
          "지평의성당": "arsenous",
        }
        const raidKey  = ALIAS_TO_KEY[raidAlias]
        const raidInfo = RAID_DATA[raidKey]

        if (!raidInfo) {
          return Response.json({ type: 4, data: { content: "❌ 알 수 없는 레이드입니다.", flags: 64 } })
        }
        if (!raidInfo.difficulties.includes(difficulty)) {
          return Response.json({ type: 4, data: { content: `❌ ${raidInfo.raidAlias}에서 지원하지 않는 난이도입니다.`, flags: 64 } })
        }

        if (!isMobaChul) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return Response.json({ type: 4, data: { content: "❌ 날짜 형식이 올바르지 않습니다. (예: 2026-05-24)", flags: 64 } })
          }
          if (!/^\d{2}:\d{2}$/.test(timeInput)) {
            return Response.json({ type: 4, data: { content: "❌ 시간 형식이 올바르지 않습니다. (예: 21:00)", flags: 64 } })
          }
          const raidDateTime = new Date(`${dateInput}T${timeInput}:00+09:00`)
          if (raidDateTime <= new Date()) {
            return Response.json({ type: 4, data: { content: "❌ 과거 날짜/시간으로는 모집을 생성할 수 없습니다.", flags: 64 } })
          }
        }

        const settings = await GuildSettings.findOne({ guildId })
        if (!settings?.announcementChannelId) {
          return Response.json({ type: 4, data: { content: "❌ 공고 채널이 설정되지 않았습니다. 봇 설정 페이지에서 먼저 설정해주세요.", flags: 64 } })
        }

        const weekStart = getLoaWeekStart()
        const weekEnd = new Date(weekStart)
        weekEnd.setUTCDate(weekStart.getUTCDate() + 7)
        const weeklyCount = await Raid.countDocuments({
          guildId,
          createdAt: { $gte: weekStart, $lt: weekEnd }
        })
        if (weeklyCount >= 20) {
          return Response.json({ type: 4, data: { content: "❌ 이번 주 레이드 공고 횟수(20회)를 초과했습니다.", flags: 64 } })
        }

        const charInputs = [char1, char2, char3, char4].filter(Boolean)
        let warningMsg = ""

        if (charInputs.length > totalRounds) {
          charInputs.splice(totalRounds)
          warningMsg = `\n⚠️ ${totalRounds}수보다 많은 캐릭터가 입력되어 초과된 캐릭터를 제외하고 모집 등록했습니다.`
        } else if (charInputs.length > 0 && charInputs.length < totalRounds) {
          warningMsg = `\n⚠️ ${totalRounds}수 레이드인데 캐릭터가 ${charInputs.length}개만 입력됐습니다. 나머지 ${totalRounds - charInputs.length}개 슬롯은 비워두고 모집을 생성했습니다.`
        }

        let hostCharacters = []
        if (charInputs.length > 0) {
          const userChars = await UserCharacters.findOne({ discordId: userId })
          if (userChars) {
            const userCharsObj = userChars.toObject()
            let allChars = []
            if (userCharsObj.accounts?.length > 0) {
              userCharsObj.accounts.forEach(acc =>
                (acc.characters || []).forEach(c => allChars.push(c))
              )
            } else {
              allChars = userCharsObj.characters || []
            }
            hostCharacters = charInputs.map(name => allChars.find(c => c.name === name)).filter(Boolean)
          }
        }

        const hostImage = interaction.member?.user?.avatar
          ? `https://cdn.discordapp.com/avatars/${userId}/${interaction.member.user.avatar}.png`
          : null

        const buildRounds = () => Array.from({ length: totalRounds }, (_, i) => {
          const order = i + 1
          const participants = []
          const char = hostCharacters[i]
          if (char) {
            const role = SUPPORTER_CLASSES.includes(char.class) ? "support" : "dealer"
            participants.push({
              userId, userName, userImage: hostImage, role,
              characterName: char.name, characterClass: char.class,
              characterLevel: char.level, characterCombatPower: char.combatPower || null,
            })
          }
          return { order, participants }
        })

        let topParticipants = []
        if (totalRounds === 1 && hostCharacters.length > 0) {
          const char = hostCharacters[0]
          const role = SUPPORTER_CLASSES.includes(char.class) ? "support" : "dealer"
          topParticipants = [{
            userId, userName, userImage: hostImage, role,
            characterName: char.name, characterClass: char.class,
            characterLevel: char.level, characterCombatPower: char.combatPower || null,
          }]
        }

        const raid = await Raid.create({
          raidName: raidInfo.raidName,
          raidAlias: raidInfo.raidAlias,
          raidTag: raidInfo.raidTag,
          difficulty,
          maxPlayers: raidInfo.maxPlayers,
          date: dateInput,
          time: timeInput,
          isMobaChul,
          difficulty_level: difficultyLevel || null,
          discordChannelId: settings.announcementChannelId,
          guildId,
          hostId: userId,
          hostName: userName,
          hostImage,
          participants: totalRounds === 1 ? topParticipants : [],
          status: "모집중",
          notifyMinutesBefore: 30,
          totalRounds,
          rounds: buildRounds(),
          isTrain: false,
          trainKey: null,
          trainLabel: null,
          trainRaids: [],
        })

        try {
          const msgId = await sendRaidAnnouncement(
            settings.announcementChannelId,
            {
              raidName: raidInfo.raidName,
              raidAlias: raidInfo.raidAlias,
              difficulty,
              maxPlayers: raidInfo.maxPlayers,
              date: dateInput,
              time: timeInput,
              isMobaChul,
              totalRounds,
              difficulty_level: difficultyLevel || null,
              rounds: buildRounds(),
            },
            userName,
            raid._id.toString(),
            totalRounds === 1 ? topParticipants : []
          )
          await Raid.findByIdAndUpdate(raid._id, { discordMessageId: msgId })
        } catch (e) {
          console.error(`/${commandName} 공고 메시지 전송 실패:`, e.message)
        }

        return Response.json({
          type: 4,
          data: {
            content: `✅ **${raidInfo.raidAlias} ${difficulty} (${difficultyLevel})** 모집이 생성되었습니다!\n<#${settings.announcementChannelId}>를 확인해주세요.${warningMsg}`,
            flags: 64
          }
        })
      }

      // /참가
      if (commandName === "참가") {
        const options = interaction.data.options || []
        const raidId = options.find(o => o.name === "레이드id")?.value?.trim()
        const characterName = options.find(o => o.name === "캐릭터")?.value?.trim()
        const char2 = options.find(o => o.name === "캐릭터2")?.value?.trim() || null
        const char3 = options.find(o => o.name === "캐릭터3")?.value?.trim() || null
        const char4 = options.find(o => o.name === "캐릭터4")?.value?.trim() || null
        const userName = interaction.member?.user?.username || interaction.user?.username

        const raid = await Raid.findById(raidId).catch(() => null)
        if (!raid) {
          return Response.json({ type: 4, data: { content: "❌ 레이드를 찾을 수 없습니다. ID를 다시 확인해주세요.", flags: 64 } })
        }
        if (raid.status !== "모집중") {
          return Response.json({ type: 4, data: { content: "❌ 모집이 마감된 레이드입니다.", flags: 64 } })
        }
        if (isExpired(raid)) {
          return Response.json({ type: 4, data: { content: "❌ 이미 기한이 지난 레이드입니다.", flags: 64 } })
        }
        if (raid.guildId && raid.guildId !== guildId) {
          return Response.json({ type: 4, data: { content: "❌ 다른 서버의 레이드에는 참가할 수 없습니다.", flags: 64 } })
        }

        // ── N수 레이드 분기 ──────────────────────────────────────────────────
        if (raid.totalRounds >= 2) {
          const nsuChars = [characterName, char2, char3, char4].filter(Boolean)

          if (nsuChars.length < raid.totalRounds) {
            return Response.json({
              type: 4,
              data: {
                content: `❌ ${raid.totalRounds}수 레이드입니다. 캐릭터를 ${raid.totalRounds}개 입력해주세요.\n(캐릭터~캐릭터${raid.totalRounds} 파라미터 사용)`,
                flags: 64
              }
            })
          }

          const finalChars = nsuChars.slice(0, raid.totalRounds)

          if (new Set(finalChars).size !== finalChars.length) {
            return Response.json({
              type: 4,
              data: { content: "❌ 같은 캐릭터를 여러 수에 배치할 수 없습니다.", flags: 64 }
            })
          }

          const alreadyIn = raid.rounds.some(r =>
            r.participants.some(p => p.userId === userId)
          )
          if (alreadyIn) {
            return Response.json({
              type: 4,
              data: { content: "❌ 이미 참가 신청한 레이드입니다.", flags: 64 }
            })
          }

          const userCharsNsu = await UserCharacters.findOne({ discordId: userId })
          if (!userCharsNsu) {
            return Response.json({
              type: 4,
              data: { content: "❌ 캐릭터 연동이 필요합니다.", flags: 64 }
            })
          }
          const nsuCharsObj = userCharsNsu.toObject()
          let allNsuChars = []
          if (nsuCharsObj.accounts?.length > 0) {
            nsuCharsObj.accounts.forEach(acc =>
              (acc.characters || []).forEach(c => allNsuChars.push(c))
            )
          } else {
            allNsuChars = nsuCharsObj.characters || []
          }

          const supporterSlots = raid.maxPlayers / 4
          const dealerSlots = raid.maxPlayers - supporterSlots
          const minLevel = getMinLevel(raid.raidAlias, raid.difficulty)
            || getMinLevel(raid.raidName, raid.difficulty) || 0

          for (let i = 0; i < finalChars.length; i++) {
            const charName = finalChars[i]
            const char = allNsuChars.find(c => c.name === charName)
            if (!char) {
              return Response.json({
                type: 4,
                data: { content: `❌ ${i + 1}수 캐릭터 "${charName}"를 찾을 수 없습니다.`, flags: 64 }
              })
            }
            if (minLevel && char.level < minLevel) {
              return Response.json({
                type: 4,
                data: { content: `❌ ${i + 1}수 캐릭터 레벨이 부족합니다. (필요: ${minLevel}+, 현재: ${char.level})`, flags: 64 }
              })
            }
            const role = SUPPORTER_CLASSES.includes(char.class) ? "support" : "dealer"
            const round = raid.rounds.find(r => r.order === i + 1)
            if (!round) continue

            const roundDealers = round.participants.filter(p => p.role === "dealer")
            const roundSupporters = round.participants.filter(p => p.role === "support")
            if (role === "dealer" && roundDealers.length >= dealerSlots) {
              return Response.json({
                type: 4,
                data: { content: `❌ ${i + 1}수 딜러 자리가 꽉 찼습니다.`, flags: 64 }
              })
            }
            if (role === "support" && roundSupporters.length >= supporterSlots) {
              return Response.json({
                type: 4,
                data: { content: `❌ ${i + 1}수 서포터 자리가 꽉 찼습니다.`, flags: 64 }
              })
            }
            const nsuUserImage = interaction.member?.user?.avatar
              ? `https://cdn.discordapp.com/avatars/${userId}/${interaction.member.user.avatar}.png`
              : null
            round.participants.push({
              userId, userName, userImage: nsuUserImage,
              role,
              characterName: char.name,
              characterClass: char.class,
              characterLevel: char.level,
              characterCombatPower: char.combatPower || null,
            })
          }

          const allFull = raid.rounds.every(r => {
            const d = r.participants.filter(p => p.role === "dealer").length
            const s = r.participants.filter(p => p.role === "support").length
            return d >= dealerSlots && s >= supporterSlots
          })
          if (allFull) raid.status = "모집완료"
          raid.markModified("rounds")
          await raid.save()
          after(async () => { await updateMessage(raid) })
          return Response.json({
            type: 4,
            data: {
              content: `✅ **${userName}**님이 ${raid.totalRounds}수 레이드에 참가했습니다!\n캐릭터: ${finalChars.join(", ")}`,
              flags: 64
            }
          })
        }

        // ── 단일 레이드 분기 ─────────────────────────────────────────────────
        const userChars = await UserCharacters.findOne({ discordId: userId })
        if (!userChars) {
          return Response.json({ type: 4, data: { content: "❌ 캐릭터 연동이 필요합니다. 디스코드 봇에서 캐릭터 인증 후 다시 시도해주세요.", flags: 64 } })
        }

        const userCharsObj = userChars.toObject()
        let allChars = []
        if (userCharsObj.accounts?.length > 0) {
          userCharsObj.accounts.forEach(acc =>
            (acc.characters || []).forEach(c => allChars.push(c))
          )
        } else {
          allChars = userCharsObj.characters || []
        }
        const char = allChars.find(c => c.name === characterName)
        if (!char) {
          return Response.json({ type: 4, data: { content: "❌ 선택한 캐릭터를 찾을 수 없습니다.", flags: 64 } })
        }

        if (raid.participants.some(p => p.userId === userId)) {
          return Response.json({ type: 4, data: { content: "❌ 이미 참가 신청한 레이드입니다.", flags: 64 } })
        }

        const role = SUPPORTER_CLASSES.includes(char.class) ? "support" : "dealer"
        const supporterSlots = raid.maxPlayers / 4
        const dealerSlots = raid.maxPlayers - supporterSlots
        const currentDealers = raid.participants.filter(p => p.role === "dealer")
        const currentSupporters = raid.participants.filter(p => p.role === "support")

        if (role === "dealer" && currentDealers.length >= dealerSlots) {
          return Response.json({ type: 4, data: { content: "❌ 딜러 자리가 꽉 찼습니다.", flags: 64 } })
        }
        if (role === "support" && currentSupporters.length >= supporterSlots) {
          return Response.json({ type: 4, data: { content: "❌ 서포터 자리가 꽉 찼습니다.", flags: 64 } })
        }

        const minLevel = getMinLevel(raid.raidAlias, raid.difficulty) || getMinLevel(raid.raidName, raid.difficulty) || 0
        if (minLevel > 0 && char.level < minLevel) {
          return Response.json({ type: 4, data: { content: `❌ 캐릭터 레벨이 부족합니다. (필요: ${minLevel}+, 현재: ${char.level})`, flags: 64 } })
        }

        if (role === "dealer" && raid.maxPlayers === 4) {
          const existingClasses = new Set(currentDealers.map(p => p.characterClass).filter(Boolean))
          if (existingClasses.has(char.class)) {
            return Response.json({ type: 4, data: { content: "❌ 이미 같은 직업의 딜러가 있습니다. (4인 레이드는 직업 중복 불가)", flags: 64 } })
          }
        }
        if (role === "dealer" && raid.maxPlayers === 8) {
          const classCount = {}
          for (const p of currentDealers) {
            if (p.characterClass) classCount[p.characterClass] = (classCount[p.characterClass] || 0) + 1
          }
          if ((classCount[char.class] || 0) >= 2) {
            return Response.json({ type: 4, data: { content: "❌ 같은 직업은 최대 2명까지 참가 가능합니다.", flags: 64 } })
          }
        }

        const userImage = interaction.member?.user?.avatar
          ? `https://cdn.discordapp.com/avatars/${userId}/${interaction.member.user.avatar}.png`
          : null

        raid.participants.push({
          userId, userName, userImage,
          role,
          characterName: char.name,
          characterClass: char.class,
          characterLevel: char.level,
          characterCombatPower: char.combatPower || null,
        })

        const totalFilled = raid.participants.length
        if (totalFilled >= raid.maxPlayers && raid.status === "모집중") {
          raid.status = "모집완료"
        }
        await raid.save()

        after(async () => { await updateMessage(raid) })

        const roleText = role === "dealer" ? "⚔️ 딜러" : "🛡️ 서포터"
        return Response.json({
          type: 4,
          data: {
            content: `✅ **${userName}**님이 ${roleText}로 참가했습니다!\n캐릭터: ${char.class} ${char.name} (Lv.${char.level})`,
            flags: 64
          }
        })
      }

      // /같이참가
      if (commandName === "같이참가") {
        const options = interaction.data.options || []
        const raidId = options.find(o => o.name === "레이드id")?.value?.trim()
        const targetUserId = options.find(o => o.name === "같이참가유저")?.value
        const userName = interaction.member?.user?.username || interaction.user?.username

        const myChars = [
          options.find(o => o.name === "내캐릭터1")?.value?.trim(),
          options.find(o => o.name === "내캐릭터2")?.value?.trim() || null,
          options.find(o => o.name === "내캐릭터3")?.value?.trim() || null,
          options.find(o => o.name === "내캐릭터4")?.value?.trim() || null,
        ].filter(Boolean)
        const targetChars = [
          options.find(o => o.name === "유저캐릭터1")?.value?.trim(),
          options.find(o => o.name === "유저캐릭터2")?.value?.trim() || null,
          options.find(o => o.name === "유저캐릭터3")?.value?.trim() || null,
          options.find(o => o.name === "유저캐릭터4")?.value?.trim() || null,
        ].filter(Boolean)

        const raid = await Raid.findById(raidId).catch(() => null)
        if (!raid) return Response.json({ type: 4, data: { content: "❌ 레이드를 찾을 수 없습니다.", flags: 64 } })
        if (raid.status !== "모집중") return Response.json({ type: 4, data: { content: "❌ 모집이 마감된 레이드입니다.", flags: 64 } })
        if (isExpired(raid)) return Response.json({ type: 4, data: { content: "❌ 기한이 지난 레이드입니다.", flags: 64 } })
        if (raid.guildId && raid.guildId !== guildId) return Response.json({ type: 4, data: { content: "❌ 다른 서버의 레이드입니다.", flags: 64 } })

        const minLevel = getMinLevel(raid.raidAlias, raid.difficulty) || getMinLevel(raid.raidName, raid.difficulty) || 0
        const supporterSlots = raid.maxPlayers / 4
        const dealerSlots = raid.maxPlayers - supporterSlots

        // 캐릭터 쌍 수 vs totalRounds 처리
        let warningMsg = ""
        const pairCount = Math.min(myChars.length, targetChars.length)

        let finalPairCount
        if (raid.totalRounds <= 1) {
          finalPairCount = 1
        } else {
          if (pairCount < raid.totalRounds) {
            const myCharParams = myChars.map((c, i) => `내캐릭터${i + 1}:${c}`).join(" ")
            const targetCharParams = targetChars.map((c, i) => `유저캐릭터${i + 1}:${c}`).join(" ")
            return Response.json({
              type: 4,
              data: {
                content: [
                  `❌ ${raid.totalRounds}수 레이드인데 캐릭터 쌍이 ${pairCount}개만 입력됐습니다.`,
                  `내캐릭터${pairCount + 1}~내캐릭터${raid.totalRounds} / 유저캐릭터${pairCount + 1}~유저캐릭터${raid.totalRounds} 를 추가해서 다시 입력해주세요:`,
                  ``,
                  `/같이참가 레이드id:${raidId} ${myCharParams} 같이참가유저:<@${targetUserId}> ${targetCharParams}`,
                ].join("\n"),
                flags: 64,
              },
            })
          } else if (pairCount > raid.totalRounds) {
            warningMsg = `\n⚠️ ${raid.totalRounds}수보다 많은 캐릭터가 입력되어 초과된 캐릭터를 제외하고 등록했습니다.`
          }
          finalPairCount = Math.min(pairCount, raid.totalRounds)
        }

        // 내 캐릭터 조회
        const myUserChars = await UserCharacters.findOne({ discordId: userId })
        if (!myUserChars) return Response.json({ type: 4, data: { content: "❌ 캐릭터 연동이 필요합니다.", flags: 64 } })
        const myCharsObj = myUserChars.toObject()
        let myAllChars = []
        if (myCharsObj.accounts?.length > 0) {
          myCharsObj.accounts.forEach(acc => (acc.characters || []).forEach(c => myAllChars.push(c)))
        } else {
          myAllChars = myCharsObj.characters || []
        }

        // 대상 유저 캐릭터 조회
        const targetUserChars = await UserCharacters.findOne({ discordId: targetUserId })
        let targetAllChars = []
        if (targetUserChars) {
          const targetCharsObj = targetUserChars.toObject()
          if (targetCharsObj.accounts?.length > 0) {
            targetCharsObj.accounts.forEach(acc => (acc.characters || []).forEach(c => targetAllChars.push(c)))
          } else {
            targetAllChars = targetCharsObj.characters || []
          }
        }

        const userImage = interaction.member?.user?.avatar
          ? `https://cdn.discordapp.com/avatars/${userId}/${interaction.member.user.avatar}.png`
          : null

        // ── 단일 레이드 (totalRounds <= 1) ──────────────────────────────────
        if (raid.totalRounds <= 1) {
          if (raid.participants.some(p => p.userId === userId || p.userId === targetUserId)) {
            return Response.json({ type: 4, data: { content: "❌ 이미 참가 신청한 레이드입니다.", flags: 64 } })
          }

          const myChar = myAllChars.find(c => c.name === myChars[0])
          if (!myChar) return Response.json({ type: 4, data: { content: `❌ 내 캐릭터 "${myChars[0]}"를 찾을 수 없습니다.`, flags: 64 } })

          let targetChar = targetAllChars.find(c => c.name === targetChars[0])
          if (!targetChar) targetChar = { name: targetChars[0], class: null, level: null, combatPower: null }

          if (minLevel && myChar.level < minLevel) {
            return Response.json({
              type: 4,
              data: { content: `❌ 내 캐릭터 레벨이 부족합니다. (필요: ${minLevel}+, 현재: ${myChar.level})`, flags: 64 }
            })
          }

          const myRole = SUPPORTER_CLASSES.includes(myChar.class) ? "support" : "dealer"
          const targetRole = targetChar.class
            ? (SUPPORTER_CLASSES.includes(targetChar.class) ? "support" : "dealer")
            : "dealer"

          const dealers = raid.participants.filter(p => p.role === "dealer")
          const supporters = raid.participants.filter(p => p.role === "support")
          const dealerAdd = (myRole === "dealer" ? 1 : 0) + (targetRole === "dealer" ? 1 : 0)
          const supporterAdd = (myRole === "support" ? 1 : 0) + (targetRole === "support" ? 1 : 0)

          if (dealers.length + dealerAdd > dealerSlots) {
            return Response.json({ type: 4, data: { content: "❌ 딜러 자리가 부족합니다.", flags: 64 } })
          }
          if (supporters.length + supporterAdd > supporterSlots) {
            return Response.json({ type: 4, data: { content: "❌ 서포터 자리가 부족합니다.", flags: 64 } })
          }

          raid.participants.push({
            userId, userName, userImage,
            role: myRole,
            characterName: myChar.name,
            characterClass: myChar.class,
            characterLevel: myChar.level,
            characterCombatPower: myChar.combatPower || null,
          })
          raid.participants.push({
            userId: targetUserId,
            userName: targetChars[0],
            userImage: null,
            role: targetRole,
            characterName: targetChar.name,
            characterClass: targetChar.class,
            characterLevel: targetChar.level,
            characterCombatPower: targetChar.combatPower || null,
          })

          const newDealers = raid.participants.filter(p => p.role === "dealer")
          const newSupporters = raid.participants.filter(p => p.role === "support")
          const isFull = newDealers.length >= dealerSlots && newSupporters.length >= supporterSlots

          if (isFull && raid.isMobaChul) {
            await raid.save()
            await launchRaid(raid)
            return Response.json({
              type: 4,
              data: { content: `✅ **${userName}**님과 <@${targetUserId}>님이 함께 참가했습니다! 🚀 출발!${warningMsg}` }
            })
          }
          if (isFull) raid.status = "모집완료"
          await raid.save()
          after(async () => { await updateMessage(raid) })

          return Response.json({
            type: 4,
            data: {
              content: `✅ **${userName}**님과 <@${targetUserId}>님이 함께 참가했습니다!\n${userName}: ${myChar.name}\n<@${targetUserId}>: ${targetChar.name}${warningMsg}`
            }
          })
        }

        // ── N수 레이드 (totalRounds >= 2) ───────────────────────────────────
        if (raid.rounds.some(r => r.participants.some(p => p.userId === userId || p.userId === targetUserId))) {
          return Response.json({ type: 4, data: { content: "❌ 이미 참가 신청한 레이드입니다.", flags: 64 } })
        }

        for (let i = 0; i < finalPairCount; i++) {
          const round = raid.rounds.find(r => r.order === i + 1)
          if (!round) continue

          const myChar = myAllChars.find(c => c.name === myChars[i])
          if (!myChar) {
            return Response.json({
              type: 4,
              data: { content: `❌ 내 ${i + 1}수 캐릭터 "${myChars[i]}"를 찾을 수 없습니다.`, flags: 64 }
            })
          }

          let targetChar = targetAllChars.find(c => c.name === targetChars[i])
          if (!targetChar) targetChar = { name: targetChars[i], class: null, level: null, combatPower: null }

          const myRole = SUPPORTER_CLASSES.includes(myChar.class) ? "support" : "dealer"
          const targetRole = targetChar.class
            ? (SUPPORTER_CLASSES.includes(targetChar.class) ? "support" : "dealer")
            : "dealer"

          const roundDealers = round.participants.filter(p => p.role === "dealer")
          const roundSupporters = round.participants.filter(p => p.role === "support")
          const dealerAdd = (myRole === "dealer" ? 1 : 0) + (targetRole === "dealer" ? 1 : 0)
          const supporterAdd = (myRole === "support" ? 1 : 0) + (targetRole === "support" ? 1 : 0)

          if (roundDealers.length + dealerAdd > dealerSlots) {
            return Response.json({ type: 4, data: { content: `❌ ${i + 1}수 딜러 자리가 부족합니다.`, flags: 64 } })
          }
          if (roundSupporters.length + supporterAdd > supporterSlots) {
            return Response.json({ type: 4, data: { content: `❌ ${i + 1}수 서포터 자리가 부족합니다.`, flags: 64 } })
          }

          round.participants.push({
            userId, userName, userImage,
            role: myRole,
            characterName: myChar.name,
            characterClass: myChar.class,
            characterLevel: myChar.level,
            characterCombatPower: myChar.combatPower || null,
          })
          round.participants.push({
            userId: targetUserId,
            userName: targetChars[i],
            userImage: null,
            role: targetRole,
            characterName: targetChar.name,
            characterClass: targetChar.class,
            characterLevel: targetChar.level,
            characterCombatPower: targetChar.combatPower || null,
          })
        }

        const allFull = raid.rounds.every(r => {
          const d = r.participants.filter(p => p.role === "dealer").length
          const s = r.participants.filter(p => p.role === "support").length
          return d >= dealerSlots && s >= supporterSlots
        })
        if (allFull) raid.status = "모집완료"
        raid.markModified("rounds")
        await raid.save()
        after(async () => { await updateMessage(raid) })

        const charSummary = myChars.slice(0, finalPairCount).join(", ")
        const targetSummary = targetChars.slice(0, finalPairCount).join(", ")
        return Response.json({
          type: 4,
          data: {
            content: `✅ **${userName}**님과 <@${targetUserId}>님이 함께 참가했습니다!\n${userName}: ${charSummary}\n<@${targetUserId}>: ${targetSummary}${warningMsg}`
          }
        })
      }

      return Response.json({
        type: 4,
        data: { content: "❌ 알 수 없는 명령어입니다.", flags: 64 }
      })
    }

    // ── 모달 제출 ──────────────────────────────────────────────────────────
    if (interaction.type === 5) {
      await connectDB()

      const customId = interaction.data.custom_id
      const userId = interaction.member?.user?.id || interaction.user?.id

      // ── [기차] Step 5: 기차 생성 모달 제출 ──────────────────────────────
      const trainSubmitMatch = customId.match(/^train_submit_(\d+)_(.+)_(\d+)$/)
      if (trainSubmitMatch) {
        const level      = trainSubmitMatch[1]
        const presetId   = trainSubmitMatch[2]
        const maxPlayers = parseInt(trainSubmitMatch[3])

        const comps    = interaction.data.components
        const mobachul = comps[0].components[0].value.toLowerCase().trim()
        const dateInput = (comps[1].components[0].value || "").trim()
        const timeInput = (comps[2].components[0].value || "").trim()
        const difficultyLevelInput = (comps[3]?.components[0]?.value || "").trim() || null

        if (!["y", "n"].includes(mobachul)) {
          return Response.json({ type: 4, data: { content: "❌ 모바출 여부는 y 또는 n으로 입력해주세요.", flags: 64 } })
        }
        const isMobaChul = mobachul === "y"
        if (!isMobaChul && (!dateInput || !timeInput)) {
          return Response.json({ type: 4, data: { content: "❌ 모바출이 아닌 경우 날짜와 시간을 입력해주세요.", flags: 64 } })
        }

        // presetId로 기차 구성 조회
        const tierData = TRAIN_PRESETS[level]
        const preset = tierData?.options.find(o => o.id === presetId)
        if (!preset) {
          return Response.json({ type: 4, data: { content: "❌ 알 수 없는 기차 구성입니다.", flags: 64 } })
        }

        // GuildSettings 조회
        const guildId  = interaction.guild_id
        const hostId   = interaction.member?.user?.id || interaction.user?.id
        const hostName = interaction.member?.user?.username || interaction.user?.username
        const hostAvatar = interaction.member?.user?.avatar
        const hostImage  = hostAvatar ? `https://cdn.discordapp.com/avatars/${hostId}/${hostAvatar}.png` : null

        const settings = await GuildSettings.findOne({ guildId })
        if (!settings?.announcementChannelId) {
          return Response.json({ type: 4, data: { content: "❌ 봇 설정에서 공고 채널을 먼저 지정해주세요.", flags: 64 } })
        }

        if (guildId) {
          const weekStart = getLoaWeekStart()
          const weekEnd = new Date(weekStart)
          weekEnd.setUTCDate(weekStart.getUTCDate() + 7)
          const weeklyCount = await Raid.countDocuments({ guildId, createdAt: { $gte: weekStart, $lt: weekEnd } })
          if (weeklyCount >= 20) {
            return Response.json({ type: 4, data: { content: "❌ 이번 주 레이드 공고 횟수(20회)를 초과했습니다. 다음 주 수요일에 초기화됩니다.", flags: 64 } })
          }
        }

        const firstRaid = preset.raids[0]
        const trainRaid = await Raid.create({
          isTrain:    true,
          trainKey:   presetId,
          trainLabel: preset.trainLabel,
          trainRaids: preset.raids.map((r, i) => ({
            order:      i + 1,
            raidAlias:  r.alias || r.raidAlias || "",
            raidTag:    r.tag   || r.raidTag   || "",
            raidName:   r.name  || r.raidName  || "",
            difficulty: r.difficulty,
            maxPlayers: r.maxPlayers,
          })),
          // Raid 스키마 필수 필드 (첫 번째 레이드 기준)
          raidName:  firstRaid.name  || firstRaid.raidName  || "",
          raidAlias: firstRaid.alias || firstRaid.raidAlias || "",
          raidTag:   firstRaid.tag   || firstRaid.raidTag   || "",
          difficulty: firstRaid.difficulty || "",
          maxPlayers,
          isMobaChul,
          difficulty_level: difficultyLevelInput,
          date:             isMobaChul ? "" : dateInput,
          time:             isMobaChul ? "" : timeInput,
          discordChannelId: settings.announcementChannelId,
          guildId,
          hostId,
          hostName,
          hostImage,
          participants: [],
          status: "모집중",
        })

        try {
          const msgId = await sendTrainRaidAnnouncement(settings.announcementChannelId, trainRaid)
          await Raid.findByIdAndUpdate(trainRaid._id, { discordMessageId: msgId })
        } catch (e) {
          console.error("기차 공고 메시지 전송 실패:", e)
        }

        return Response.json({ type: 4, data: { content: `✅ ${preset.trainLabel} 모집이 생성되었습니다!`, flags: 64 } })
      }

      // 5단계: 레이드 생성 모달 제출
      const raidSubmitMatch = customId.match(/^raid_submit_([a-z]+)_(.+)$/)
      if (raidSubmitMatch) {
        const raidValue  = raidSubmitMatch[1]
        const difficulty = raidSubmitMatch[2]
        const comps = interaction.data.components
        const mobaChulInput = comps[0].components[0].value.toLowerCase().trim()
        const dateInput = (comps[1].components[0].value || "").trim()
        const timeInput = (comps[2].components[0].value || "").trim()
        const difficultyLevelInput = (comps[3]?.components[0]?.value || "").trim() || null

        if (!["y", "n"].includes(mobaChulInput)) {
          return Response.json({ type: 4, data: { content: "❌ 모바출 여부는 y 또는 n으로 입력해주세요.", flags: 64 } })
        }
        const isMobaChul = mobaChulInput === "y"
        if (!isMobaChul) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return Response.json({ type: 4, data: { content: "❌ 날짜 형식이 올바르지 않습니다. (예: 2026-04-01)", flags: 64 } })
          }
          if (!/^\d{2}:\d{2}$/.test(timeInput)) {
            return Response.json({ type: 4, data: { content: "❌ 시간 형식이 올바르지 않습니다. (예: 21:00)", flags: 64 } })
          }
        }

        const raidInfo = RAID_DATA[raidValue]
        if (!raidInfo) {
          return Response.json({ type: 4, data: { content: "❌ 알 수 없는 레이드입니다.", flags: 64 } })
        }

        const guildId   = interaction.guild_id
        const hostId    = interaction.member?.user?.id || interaction.user?.id
        const hostName  = interaction.member?.user?.username || interaction.user?.username
        const hostAvatar = interaction.member?.user?.avatar
        const hostImage = hostAvatar ? `https://cdn.discordapp.com/avatars/${hostId}/${hostAvatar}.png` : null

        const settings = await GuildSettings.findOne({ guildId })
        if (!settings?.announcementChannelId) {
          return Response.json({ type: 4, data: { content: "❌ 레이드 공고 채널이 설정되지 않았습니다.\n봇 설정 페이지에서 공고 채널을 먼저 설정해주세요.", flags: 64 } })
        }

        if (guildId) {
          const weekStart = getLoaWeekStart()
          const weekEnd = new Date(weekStart)
          weekEnd.setUTCDate(weekStart.getUTCDate() + 7)
          const weeklyCount = await Raid.countDocuments({ guildId, createdAt: { $gte: weekStart, $lt: weekEnd } })
          if (weeklyCount >= 20) {
            return Response.json({ type: 4, data: { content: "❌ 이번 주 레이드 공고 횟수(20회)를 초과했습니다. 다음 주 수요일에 초기화됩니다.", flags: 64 } })
          }
        }

        const raid = await Raid.create({
          raidName: raidInfo.raidName,
          raidAlias: raidInfo.raidAlias,
          raidTag: raidInfo.raidTag,
          difficulty,
          maxPlayers: raidInfo.maxPlayers,
          date: isMobaChul ? "" : dateInput,
          time: isMobaChul ? "" : timeInput,
          isMobaChul,
          difficulty_level: difficultyLevelInput,
          discordChannelId: settings.announcementChannelId,
          guildId,
          hostId,
          hostName,
          hostImage,
          participants: [],
          status: "모집중",
        })

        try {
          const msgId = await sendRaidAnnouncement(
            settings.announcementChannelId,
            { raidName: raidInfo.raidName, raidAlias: raidInfo.raidAlias, difficulty, maxPlayers: raidInfo.maxPlayers, date: isMobaChul ? "" : dateInput, time: isMobaChul ? "" : timeInput, isMobaChul, difficulty_level: difficultyLevelInput },
            hostName,
            raid._id.toString(),
            []
          )
          await Raid.findByIdAndUpdate(raid._id, { discordMessageId: msgId })
        } catch (e) {
          console.error("공고 메시지 전송 실패:", e)
        }

        return Response.json({ type: 4, data: { content: "✅ 레이드 모집이 생성되었습니다!", flags: 64 } })
      }

      // ── [기차] 캐릭터 연동 모달 ──────────────────────────────────────────
      const charVerifyTrainMatch = customId.match(/^char_verify_(dealer|support)_train_(.+)$/)
      if (charVerifyTrainMatch) {
        const role        = charVerifyTrainMatch[1]
        const trainRaidId = charVerifyTrainMatch[2]
        const characterName = interaction.data.components[0].components[0].value.trim()

        let characters
        try {
          characters = await fetchLostarkCharacters(characterName)
        } catch (e) {
          return Response.json({ type: 4, data: { content: "❌ 캐릭터를 찾을 수 없습니다.", flags: 64 } })
        }
        if (!characters) return Response.json({ type: 4, data: { content: "❌ 캐릭터를 찾을 수 없습니다.", flags: 64 } })

        const filteredChars = characters.filter(c => c.level >= 1680)
        await UserCharacters.findOneAndUpdate(
          { discordId: userId },
          { discordId: userId, representCharacter: characterName, characters: filteredChars, verifiedAt: new Date(), lastSyncAt: new Date() },
          { upsert: true, new: true }
        )

        const trainRaid = await Raid.findById(trainRaidId)
        if (!trainRaid || trainRaid.status !== "모집중") return Response.json({ type: 4, data: { content: "❌ 모집이 마감된 레이드입니다.", flags: 64 } })
        if (trainRaid.participants.some(p => p.userId === userId)) return Response.json({ type: 4, data: { content: "❌ 이미 참가 신청한 레이드입니다.", flags: 64 } })

        const eligibleChars = filterEligibleCharactersForTrain(filteredChars, role, trainRaid)
        const minLevels = (trainRaid.trainRaids || []).map(r => getMinLevel(r.raidAlias, r.difficulty)).filter(l => l > 0)
        const maxMinLevel = minLevels.length > 0 ? Math.max(...minLevels) : 0

        if (eligibleChars.length === 0) {
          return Response.json({ type: 4, data: { content: `✅ 캐릭터 연동 완료!\n\n❌ 이 레이드에 참가 가능한 캐릭터가 없습니다.\n(최소 레벨: ${maxMinLevel}+)`, flags: 64 } })
        }

        const options = eligibleChars.sort((a, b) => b.level - a.level).slice(0, 25).map(c => ({
          label: c.name,
          description: c.combatPower
            ? `${c.class} · Lv.${c.level} · 전투력 ${c.combatPower.toLocaleString()}`
            : `${c.class} · Lv.${c.level} · ${c.server}`,
          value: `${c.name}||${c.class}||${c.level}||${c.combatPower ?? ""}`,
        }))

        return Response.json({
          type: 4,
          data: {
            flags: 64,
            content: "✅ 캐릭터 연동 완료! 참가할 캐릭터를 선택하세요:",
            components: [{ type: 1, components: [{ type: 3, custom_id: `select_char_${role}_train_${trainRaidId}`, placeholder: "참가할 캐릭터를 선택하세요", options }] }],
          },
        })
      }

      // ── [기차] 모집 취소 확인 모달 ────────────────────────────────────────
      const cancelConfirmTrainMatch = customId.match(/^cancel_confirm_train_(.+)$/)
      if (cancelConfirmTrainMatch) {
        const trainRaidId = cancelConfirmTrainMatch[1]
        const inputValue = interaction.data.components[0].components[0].value
        if (inputValue !== "취소") {
          return Response.json({ type: 4, data: { content: "❌ '취소' 라고 정확히 입력해야 모집이 취소됩니다.", flags: 64 } })
        }
        const trainRaid = await Raid.findById(trainRaidId)
        if (!trainRaid) return Response.json({ type: 4, data: { content: "❌ 레이드를 찾을 수 없습니다.", flags: 64 } })
        if (trainRaid.hostId !== userId) return Response.json({ type: 4, data: { content: "❌ 주최자만 모집을 취소할 수 있습니다.", flags: 64 } })
        if (trainRaid.status === "취소") return Response.json({ type: 4, data: { content: "❌ 이미 취소된 레이드입니다.", flags: 64 } })

        trainRaid.status = "취소"
        await trainRaid.save()
        await updateTrainRaidDiscordMessage(trainRaid)
        return Response.json({ type: 4, data: { content: "✅ 기차 레이드 모집이 취소되었습니다.", flags: 64 } })
      }

      // 캐릭터 연동 모달 제출 → 로아 API 조회 → 선택 메뉴 표시
      const charVerifyMatch = customId.match(/^char_verify_(dealer|support)_(.+)$/)
      if (charVerifyMatch) {
        const role   = charVerifyMatch[1]
        const raidId = charVerifyMatch[2]
        const characterName = interaction.data.components[0].components[0].value.trim()

        let characters
        try {
          characters = await fetchLostarkCharacters(characterName)
        } catch (e) {
          console.error("[char_verify] LoA API 실패:", e.message)
          return Response.json({ type: 4, data: { content: "❌ 캐릭터를 찾을 수 없습니다.", flags: 64 } })
        }

        if (!characters) {
          return Response.json({ type: 4, data: { content: "❌ 캐릭터를 찾을 수 없습니다.", flags: 64 } })
        }

        // UserCharacters 저장
        const filteredChars = characters.filter(c => c.level >= 1680)
        await UserCharacters.findOneAndUpdate(
          { discordId: userId },
          {
            discordId: userId,
            representCharacter: characterName,
            characters: filteredChars,
            verifiedAt: new Date(),
            lastSyncAt: new Date(),
          },
          { upsert: true, new: true }
        )

        // 레이드 재조회 후 선택 메뉴 표시
        const raid = await Raid.findById(raidId)
        if (!raid || raid.status !== "모집중") {
          return Response.json({ type: 4, data: { content: "❌ 모집이 마감된 레이드입니다.", flags: 64 } })
        }
        if (isExpired(raid)) return Response.json(EXPIRED_MSG)
        if (raid.participants.some(p => p.userId === userId)) {
          return Response.json({ type: 4, data: { content: "❌ 이미 참가 신청한 레이드입니다.", flags: 64 } })
        }

        const eligibleChars = filterEligibleCharacters(filteredChars, role, raid)
        const minLevel = getMinLevel(raid.raidAlias, raid.difficulty)

        if (eligibleChars.length === 0) {
          return Response.json({ type: 4, data: { content: `✅ 캐릭터 연동 완료!\n\n❌ 이 레이드에 참가 가능한 캐릭터가 없습니다.\n(최소 레벨: ${minLevel}+)`, flags: 64 } })
        }

        const options = eligibleChars
          .sort((a, b) => b.level - a.level)
          .slice(0, 25)
          .map(c => ({
            label: c.name,
            description: c.combatPower
              ? `${c.class} · Lv.${c.level} · 전투력 ${c.combatPower.toLocaleString()}`
              : `${c.class} · Lv.${c.level} · ${c.server}`,
            value: `${c.name}||${c.class}||${c.level}||${c.combatPower ?? ""}`,
          }))

        return Response.json({
          type: 4,
          data: {
            flags: 64,
            content: "✅ 캐릭터 연동 완료! 참가할 캐릭터를 선택하세요:",
            components: [{
              type: 1,
              components: [{
                type: 3,
                custom_id: `select_char_${role}_${raidId}`,
                placeholder: "참가할 캐릭터를 선택하세요",
                options,
              }],
            }],
          },
        })
      }

      // ── 캐릭터 인증 모달 4칸 (char_auth_modal_register) ──────────────────
      if (customId === "char_auth_modal_register") {
        const charNames = [
          interaction.data.components[0].components[0].value.trim(),
          (interaction.data.components[1]?.components[0]?.value || "").trim(),
          (interaction.data.components[2]?.components[0]?.value || "").trim(),
          (interaction.data.components[3]?.components[0]?.value || "").trim(),
        ]
        if (!charNames[0]) {
          return Response.json({ type: 4, data: { content: "❌ 계정 1 캐릭터명은 필수입니다.", flags: 64 } })
        }
        const results = []
        for (let i = 0; i < charNames.length; i++) {
          if (!charNames[i]) continue
          const accountIndex = i + 1
          let characters
          try { characters = await fetchLostarkCharacters(charNames[i]) } catch (e) {
            return Response.json({ type: 4, data: { content: `❌ 계정 ${accountIndex} 캐릭터를 찾을 수 없습니다. 캐릭터명을 확인해주세요.`, flags: 64 } })
          }
          if (!characters) return Response.json({ type: 4, data: { content: `❌ 계정 ${accountIndex} 캐릭터를 찾을 수 없습니다.`, flags: 64 } })
          results.push({ accountIndex, characterName: charNames[i], characters })
        }
        for (const { accountIndex, characterName: charName, characters } of results) {
          const filteredChars = characters.filter(c => c.level >= 1680)
          const accountEntry = { accountIndex, representCharacter: charName, characters: filteredChars.map(c => ({ name: c.name, class: c.class, level: c.level, server: c.server })), lastSyncAt: new Date() }
          const topLevelUpdate = accountIndex === 1 ? { representCharacter: charName, characters: filteredChars, verifiedAt: new Date(), lastSyncAt: new Date() } : {}
          const updated = await UserCharacters.findOneAndUpdate(
            { discordId: userId, "accounts.accountIndex": accountIndex },
            { $set: { "accounts.$[elem]": accountEntry, ...topLevelUpdate } },
            { arrayFilters: [{ "elem.accountIndex": accountIndex }], new: true }
          )
          if (!updated) {
            const pushUpdate = { $push: { accounts: accountEntry } }
            if (accountIndex === 1) pushUpdate.$set = topLevelUpdate
            await UserCharacters.findOneAndUpdate({ discordId: userId }, pushUpdate, { upsert: true })
          }
        }
        return Response.json({ type: 4, data: { flags: 64, content: `✅ ${results.length}개 계정 캐릭터 인증이 완료되었습니다!\n레이드 참가 시 캐릭터 정보와 함께 참가할 수 있어요!` } })
      }

      // ── 캐릭터 변경 모달 4칸 (char_auth_modal_update) ───────────────────
      if (customId === "char_auth_modal_update") {
        const charNames = [
          interaction.data.components[0].components[0].value.trim(),
          (interaction.data.components[1]?.components[0]?.value || "").trim(),
          (interaction.data.components[2]?.components[0]?.value || "").trim(),
          (interaction.data.components[3]?.components[0]?.value || "").trim(),
        ]
        if (!charNames[0]) {
          return Response.json({ type: 4, data: { content: "❌ 계정 1 캐릭터명은 필수입니다.", flags: 64 } })
        }
        const results = []
        for (let i = 0; i < charNames.length; i++) {
          if (!charNames[i]) continue
          const accountIndex = i + 1
          let characters
          try { characters = await fetchLostarkCharacters(charNames[i]) } catch (e) {
            return Response.json({ type: 4, data: { content: `❌ 계정 ${accountIndex} 캐릭터를 찾을 수 없습니다. 캐릭터명을 확인해주세요.`, flags: 64 } })
          }
          if (!characters) return Response.json({ type: 4, data: { content: `❌ 계정 ${accountIndex} 캐릭터를 찾을 수 없습니다.`, flags: 64 } })
          results.push({ accountIndex, characterName: charNames[i], characters })
        }
        for (const { accountIndex, characterName: charName, characters } of results) {
          const filteredChars = characters.filter(c => c.level >= 1680)
          const accountEntry = { accountIndex, representCharacter: charName, characters: filteredChars.map(c => ({ name: c.name, class: c.class, level: c.level, server: c.server })), lastSyncAt: new Date() }
          const topLevelUpdate = accountIndex === 1 ? { representCharacter: charName, characters: filteredChars, verifiedAt: new Date(), lastSyncAt: new Date() } : {}
          const updated = await UserCharacters.findOneAndUpdate(
            { discordId: userId, "accounts.accountIndex": accountIndex },
            { $set: { "accounts.$[elem]": accountEntry, ...topLevelUpdate } },
            { arrayFilters: [{ "elem.accountIndex": accountIndex }], new: true }
          )
          if (!updated) {
            const pushUpdate = { $push: { accounts: accountEntry } }
            if (accountIndex === 1) pushUpdate.$set = topLevelUpdate
            await UserCharacters.findOneAndUpdate({ discordId: userId }, pushUpdate, { upsert: true })
          }
        }
        return Response.json({ type: 4, data: { flags: 64, content: `✅ ${results.length}개 계정 캐릭터 정보가 변경되었습니다!` } })
      }

      // ── 캐릭터 변경 모달 단일 계정 (char_auth_modal_update_N, 레거시) ────
      const charAuthModalUpdateMatch = customId.match(/^char_auth_modal_update_(\d+)$/)
      if (charAuthModalUpdateMatch) {
        const accountIndex = parseInt(charAuthModalUpdateMatch[1])
        const characterName = interaction.data.components[0].components[0].value.trim()
        let characters
        try { characters = await fetchLostarkCharacters(characterName) } catch (e) {
          return Response.json({ type: 4, data: { content: "❌ 캐릭터를 찾을 수 없습니다. 캐릭터명을 확인해주세요.", flags: 64 } })
        }
        if (!characters) return Response.json({ type: 4, data: { content: "❌ 캐릭터를 찾을 수 없습니다. 캐릭터명을 확인해주세요.", flags: 64 } })

        const filteredChars = characters.filter(c => c.level >= 1680)
        const accountEntry = { accountIndex, representCharacter: characterName, characters: filteredChars.map(c => ({ name: c.name, class: c.class, level: c.level, server: c.server })), lastSyncAt: new Date() }
        const topLevelUpdate = accountIndex === 1 ? { representCharacter: characterName, characters: filteredChars, verifiedAt: new Date(), lastSyncAt: new Date() } : {}
        const updated = await UserCharacters.findOneAndUpdate(
          { discordId: userId, "accounts.accountIndex": accountIndex },
          { $set: { "accounts.$[elem]": accountEntry, ...topLevelUpdate } },
          { arrayFilters: [{ "elem.accountIndex": accountIndex }], new: true }
        )
        if (!updated) {
          const pushUpdate = { $push: { accounts: accountEntry } }
          if (accountIndex === 1) pushUpdate.$set = topLevelUpdate
          await UserCharacters.findOneAndUpdate({ discordId: userId }, pushUpdate, { upsert: true })
        }
        const maxChar = filteredChars.length > 0
          ? filteredChars.reduce((a, b) => b.level > a.level ? b : a, filteredChars[0])
          : null
        return Response.json({
          type: 4,
          data: { flags: 64, content: [`✅ **${characterName}** 캐릭터 변경이 완료되었습니다!`, "", "📋 **원정대 정보**", `총 ${filteredChars.length}개 캐릭터 등록 (1680+)`, ...(maxChar ? [`최고 레벨: ${maxChar.level} (${maxChar.class})`] : []), "", "레이드 참가 시 캐릭터 정보와 함께 참가할 수 있어요!"].join("\n") },
        })
      }

      // ── N수 레이드 캐릭터 연동 모달 → 참가 선택 메뉴 표시 ────────────────
      const charVerifyNsuMatch = customId.match(/^char_verify_nsu_(.+)$/)
      if (charVerifyNsuMatch) {
        const raidId = charVerifyNsuMatch[1]
        const characterName = interaction.data.components[0].components[0].value.trim()

        let characters
        try {
          characters = await fetchLostarkCharacters(characterName)
        } catch (e) {
          return Response.json({ type: 4, data: { content: "❌ 캐릭터를 찾을 수 없습니다.", flags: 64 } })
        }
        if (!characters) return Response.json({ type: 4, data: { content: "❌ 캐릭터를 찾을 수 없습니다.", flags: 64 } })

        const filteredChars = characters.filter(c => c.level >= 1680)
        await UserCharacters.findOneAndUpdate(
          { discordId: userId },
          { discordId: userId, representCharacter: characterName, characters: filteredChars, verifiedAt: new Date(), lastSyncAt: new Date() },
          { upsert: true, new: true }
        )

        const raid = await Raid.findById(raidId)
        if (!raid || raid.totalRounds < 2 || raid.status !== "모집중") {
          return Response.json({ type: 4, data: { content: "✅ 캐릭터 연동 완료!\n\n❌ 모집이 마감된 레이드입니다.", flags: 64 } })
        }

        const minLevel = getMinLevel(raid.raidAlias, raid.difficulty)
        const eligible = filteredChars.filter(c => !minLevel || c.level >= minLevel)
        if (eligible.length === 0) {
          return Response.json({ type: 4, data: { content: `✅ 캐릭터 연동 완료!\n\n❌ 이 레이드에 참가 가능한 캐릭터가 없습니다.\n(최소 레벨: ${minLevel}+)`, flags: 64 } })
        }

        const options = eligible.sort((a, b) => b.level - a.level).slice(0, 25).map(c => ({
          label: c.name,
          description: `${c.class} · Lv.${c.level} · [계정1]`,
          value: `${c.name}||${c.class}||${c.level}||`,
        }))

        await NsuSession.findOneAndUpdate(
          { userId, raidId },
          { $set: { selections: new Map(), createdAt: new Date() } },
          { upsert: true, new: true }
        )

        const selectRows = Array.from({ length: raid.totalRounds }, (_, i) => ({
          type: 1,
          components: [{
            type: 3,
            custom_id: `select_nsu_char_${i + 1}_${raidId}`,
            placeholder: `${i + 1}수 캐릭터 선택`,
            options,
          }],
        }))

        return Response.json({
          type: 4,
          data: {
            flags: 64,
            content: `✅ 캐릭터 연동 완료! **${raid.raidAlias} ${raid.difficulty} ${raid.totalRounds}수** 각 수별 참가할 캐릭터를 선택하세요:`,
            components: selectRows,
          },
        })
      }

      // ── 캐릭터 인증 제거 모달 ────────────────────────────────────────────
      if (customId === "char_auth_modal_remove") {
        const inputValue = interaction.data.components[0].components[0].value.trim()
        if (inputValue !== "삭제") {
          return Response.json({ type: 4, data: { content: "❌ '삭제' 라고 정확히 입력해주세요.", flags: 64 } })
        }
        await UserCharacters.findOneAndDelete({ discordId: userId })
        return Response.json({ type: 4, data: { content: "✅ 캐릭터 인증이 제거되었습니다.", flags: 64 } })
      }

      // 모집 취소 확인 모달
      const cancelConfirmMatch = customId.match(/^cancel_confirm_(.+)$/)
      if (cancelConfirmMatch) {
        const raidId = cancelConfirmMatch[1]
        const inputValue = interaction.data.components[0].components[0].value

        if (inputValue !== "취소") {
          return Response.json({
            type: 4,
            data: { content: "❌ '취소' 라고 정확히 입력해야 모집이 취소됩니다.", flags: 64 }
          })
        }

        const raid = await Raid.findById(raidId)

        if (!raid) {
          return Response.json({ type: 4, data: { content: "❌ 레이드를 찾을 수 없습니다.", flags: 64 } })
        }
        if (raid.hostId !== userId) {
          return Response.json({ type: 4, data: { content: "❌ 주최자만 모집을 취소할 수 있습니다.", flags: 64 } })
        }
        if (raid.status === "취소") {
          return Response.json({ type: 4, data: { content: "❌ 이미 취소된 레이드입니다.", flags: 64 } })
        }

        raid.status = "취소"
        await raid.save()
        await updateMessage(raid)

        return Response.json({ type: 4, data: { content: "✅ 레이드 모집이 취소되었습니다.", flags: 64 } })
      }
    }

    return Response.json({ type: 1 })

  } catch (error) {
    console.error("Interaction 오류:", error)
    return new Response("Internal Server Error", { status: 500 })
  }
}
