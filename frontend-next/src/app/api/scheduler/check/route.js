import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"
import GuildSettings from "@/lib/models/GuildSettings"
import FixedRaid from "@/lib/models/FixedRaid"
import { sendRaidDM, buildNotifyEmbed, buildFixedRaidNotifyEmbed } from "@/lib/discordDM"

const DISCORD_API = "https://discord.com/api/v10"

// Discord 음성채널 생성 → 생성된 채널 ID 반환
async function createVoiceChannel(name, guildId) {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!guildId) return null

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, type: 2 }), // type 2 = GUILD_VOICE
  })
  if (!res.ok) return null

  const channel = await res.json()
  return channel.id
}

// Discord 음성채널 삭제
async function deleteVoiceChannel(channelId) {
  const token = process.env.DISCORD_BOT_TOKEN
  const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${token}` },
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`음성채널 삭제 실패: ${res.status}`)
  }
}

// "YYYY-MM-DD HH:MM" 형식 문자열 반환 (KST 기준 Date 객체 입력)
function toKSTDateTimeStr(kstDate) {
  return kstDate.toISOString().slice(0, 16).replace("T", " ")
}

export async function GET(request) {
  // SCHEDULER_SECRET으로 무단 호출 방지
  const { searchParams } = new URL(request.url)
  if (searchParams.get("secret") !== process.env.SCHEDULER_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  await connectDB()

  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000)

  // notifyMinutesBefore 값별 체크 윈도우 (±5분)
  // 10분 전:  5~15분 후 시작
  // 20분 전: 15~25분 후 시작
  // 30분 전: 25~35분 후 시작
  const offset = (min) => toKSTDateTimeStr(new Date(nowKST.getTime() + min * 60 * 1000))
  const win5  = offset(5),  win15 = offset(15)
  const win25 = offset(25), win35 = offset(35)

  // ── 1. 알림 처리 (notifyMinutesBefore별 윈도우 분기) ─────────────────
  const upcomingRaids = await Raid.find({
    isMobaChul: false,
    dmSent: false,
    status: { $in: ["모집중", "모집완료"] },
    $or: [
      {
        notifyMinutesBefore: 10,
        $expr: { $and: [
          { $gte: [{ $concat: ["$date", " ", "$time"] }, win5] },
          { $lte: [{ $concat: ["$date", " ", "$time"] }, win15] },
        ]},
      },
      {
        notifyMinutesBefore: 20,
        $expr: { $and: [
          { $gte: [{ $concat: ["$date", " ", "$time"] }, win15] },
          { $lte: [{ $concat: ["$date", " ", "$time"] }, win25] },
        ]},
      },
      {
        // notifyMinutesBefore가 없는 기존 도큐먼트도 30분으로 처리
        notifyMinutesBefore: { $in: [30, null, undefined] },
        $expr: { $and: [
          { $gte: [{ $concat: ["$date", " ", "$time"] }, win25] },
          { $lte: [{ $concat: ["$date", " ", "$time"] }, win35] },
        ]},
      },
    ],
  })

  const dmResults = []

  for (const raid of upcomingRaids) {
    const raidId     = raid._id.toString()
    const notifyMin  = raid.notifyMinutesBefore ?? 30
    const vcName     = raid.isTrain ? (raid.trainLabel || "기차 레이드") : `${raid.raidAlias} 파티`

    // 이메일 embed: 기차 레이드는 구성 포함 커스텀 embed, 단일은 buildNotifyEmbed
    let embed
    if (raid.isTrain) {
      const dealers    = raid.participants.filter(p => p.role === "dealer")
      const supporters = raid.participants.filter(p => p.role === "support")
      const supporterSlots = raid.maxPlayers / 4
      const dealerSlots    = raid.maxPlayers - supporterSlots
      const dealerList = dealers.length > 0
        ? dealers.map((p, i) => { const c = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}` : ""; return `${i + 1}. ⚔️ ${p.userName}${c}` }).join("\n")
        : "없음"
      const supporterList = supporters.length > 0
        ? supporters.map((p, i) => { const c = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}` : ""; return `${i + 1}. 🛡️ ${p.userName}${c}` }).join("\n")
        : "없음"
      const raidListText = (raid.trainRaids || []).slice().sort((a, b) => a.order - b.order)
        .map((r, i) => `${i + 1}. (${r.raidTag}) ${r.raidAlias} ${r.difficulty}`).join("\n") || "구성 정보 없음"
      embed = {
        title: `⏰ ${raid.trainLabel} ${notifyMin}분 전 알림!`,
        color: 0xF39C12,
        fields: [
          { name: "📋 레이드 구성", value: raidListText, inline: false },
          { name: "📅 날짜", value: raid.date, inline: true },
          { name: "🕐 시간", value: raid.time, inline: true },
          { name: "👑 주최자", value: raid.hostName, inline: true },
          { name: `⚔️ 딜러 (${dealers.length}/${dealerSlots})`,         value: dealerList,    inline: true },
          { name: `🛡️ 서포터 (${supporters.length}/${supporterSlots})`, value: supporterList, inline: true },
        ],
        footer: { text: `LostArk Guide · 기차 레이드 · ID: ${raidId}` },
        timestamp: new Date().toISOString(),
      }
    } else {
      embed = buildNotifyEmbed(raid)
    }

    // 음성채널 생성
    let voiceChannelId = null
    if (!raid.guildId) {
      console.warn(`음성채널 생성 스킵 — guildId 없음 (raid: ${raid._id})`)
    } else {
      const guildSettings = await GuildSettings.findOne({ guildId: raid.guildId })
      if (guildSettings?.voiceChannelEnabled === false) {
        // 음성채널 생성 스킵
      } else {
        try {
          voiceChannelId = await createVoiceChannel(vcName, raid.guildId)
        } catch (e) {
          console.error(`음성채널 생성 실패 (${raid._id}):`, e.message)
        }
      }
    }

    // 주최자 + 참가자 전원에게 DM 순차 발송 (rate limit 방지)
    const recipients = [...new Set([raid.hostId, ...raid.participants.map(p => p.userId)])]
    let dmSuccessCount = 0

    for (const userId of recipients) {
      try {
        const isHost = userId === raid.hostId
        await sendRaidDM(userId, embed, { voiceChannelId, guildId: raid.guildId, isHost, raidId })
        dmSuccessCount++
      } catch (e) {
        console.error(`DM 실패 (userId: ${userId}):`, e.message)
      }
      await new Promise(r => setTimeout(r, 500))
    }

    await Raid.findByIdAndUpdate(raid._id, {
      dmSent: true,
      ...(voiceChannelId ? { voiceChannelId } : {}),
    })

    dmResults.push({
      raidId: raid._id,
      raidName: raid.isTrain ? raid.trainLabel : `${raid.raidAlias} ${raid.difficulty}`,
      dmSent: dmSuccessCount,
      voiceChannelId,
      ...(raid.isTrain ? { isTrain: true } : {}),
    })
  }

  // ── 2. 음성채널 자동 삭제 (레이드 시작 3시간 후) ─────────────────────
  const deleteThreshold = toKSTDateTimeStr(new Date(nowKST.getTime() - 3 * 60 * 60 * 1000))

  const expiredRaids = await Raid.find({
    voiceChannelId: { $exists: true, $ne: null },
    $expr: {
      $lt: [{ $concat: ["$date", " ", "$time"] }, deleteThreshold],
    },
  })

  const deleteResults = []

  for (const raid of expiredRaids) {
    try {
      await deleteVoiceChannel(raid.voiceChannelId)
    } catch (e) {
      console.error(`음성채널 삭제 실패 (channelId: ${raid.voiceChannelId}):`, e.message)
    }
    // 성공/실패 관계없이 DB는 항상 정리
    await Raid.findByIdAndUpdate(raid._id, { $unset: { voiceChannelId: "" } })
    deleteResults.push(raid._id)
  }

  // ── 3. 수요일 오전 10시 고정 레이드 주간 공지 ──────────────────────────
  const isWednesday = nowKST.getDay() === 3
  const kstHour = nowKST.getHours()
  const kstMin = nowKST.getMinutes()
  const isNearTen = kstHour === 10 && kstMin < 10

  if (isWednesday && isNearTen) {
    const wed = new Date(nowKST)
    wed.setHours(0, 0, 0, 0)

    const allFixedRaids = await FixedRaid.find({ notifyEnabled: true })

    const byGuild = {}
    for (const fr of allFixedRaids) {
      if (!byGuild[fr.guildId]) byGuild[fr.guildId] = []
      byGuild[fr.guildId].push(fr)
    }

    const WEEKDAY_NAMES = ["수", "목", "금", "토", "일", "월", "화"]

    for (const [guildId, raids] of Object.entries(byGuild)) {
      const settings = await GuildSettings.findOne({ guildId })
      if (!settings?.announcementChannelId) continue

      const byWeekday = {}
      for (const r of raids) {
        if (!byWeekday[r.weekday]) byWeekday[r.weekday] = []
        byWeekday[r.weekday].push(r)
      }

      let lines = ["📌 **이번 주 고정 레이드 일정 안내**\n━━━━━━━━━━━━━━━━━━━━"]

      for (let wd = 0; wd <= 6; wd++) {
        const dayRaids = byWeekday[wd]
        if (!dayRaids?.length) continue

        const d = new Date(wed)
        d.setDate(wed.getDate() + wd)
        const mm = String(d.getMonth() + 1).padStart(2, "0")
        const dd = String(d.getDate()).padStart(2, "0")
        const dateLabel = `${mm}/${dd}`

        lines.push(`\n📅 **${WEEKDAY_NAMES[wd]} ${dateLabel}**`)

        const sorted = dayRaids.sort((a, b) => a.time.localeCompare(b.time))
        for (const r of sorted) {
          const diffLabel = r.difficulty_level ? ` (${r.difficulty_level})` : ""
          const filled = r.slots.filter(s => s.discordId)
          const members = filled.length > 0
            ? filled.map(s => s.serverNick || s.characterName).join(", ")
            : "미정"
          lines.push(`⚔️ ${r.raidAlias} ${r.difficulty}${diffLabel} · ${r.time}`)
          lines.push(`👥 ${members}`)
        }
      }

      lines.push("\n━━━━━━━━━━━━━━━━━━━━")
      lines.push("자세한 일정 및 참가자 명단은")
      lines.push("👉 웹 대시보드에서 확인하세요")
      lines.push("https://loaraid-discobot.vercel.app/fixed-raids")

      try {
        await fetch(
          `${DISCORD_API}/channels/${settings.announcementChannelId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ content: lines.join("\n") }),
          }
        )
      } catch (e) {
        console.error(`[Scheduler] 고정 레이드 공지 실패 (${guildId}):`, e.message)
      }
    }
  }

  // ── 4. 고정 레이드 당일 DM 알림 (30분 전 ±5분) ─────────────────────────
  const todayWd = (() => {
    const day = nowKST.getDay() // 0=일 1=월 2=화 3=수 4=목 5=금 6=토
    const map = [4, 5, 6, 0, 1, 2, 3]
    return map[day]
  })()

  const todayFixedRaids = await FixedRaid.find({
    weekday: todayWd,
    notifyEnabled: true,
  })

  for (const fr of todayFixedRaids) {
    const [hh, mm] = fr.time.split(":").map(Number)
    const raidTime = new Date(nowKST)
    raidTime.setHours(hh, mm, 0, 0)
    const diffMin = (raidTime - nowKST) / 60000

    if (diffMin < 25 || diffMin > 35) continue

    const filledSlots = fr.slots.filter(s => s.discordId)
    if (filledSlots.length === 0) continue

    const todayDate = new Date(nowKST)
    const raidDateStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`

    const embed = buildFixedRaidNotifyEmbed(fr, raidDateStr)

    for (const slot of filledSlots) {
      try {
        await sendRaidDM(slot.discordId, embed, {})
      } catch (e) {
        console.error(`[Scheduler] 고정 레이드 DM 실패 (${slot.discordId}):`, e.message)
      }
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return Response.json({
    ok: true,
    checkedAt: toKSTDateTimeStr(nowKST),
    dmWindows: { "10min": `${win5}~${win15}`, "20min": `${win15}~${win25}`, "30min": `${win25}~${win35}` },
    dmSent: dmResults,
    voiceChannelsDeleted: deleteResults,
  })
}
