import { connectDB } from "@/lib/mongodb"
import RaidModel from "@/lib/models/Raid"

const DISCORD_API = "https://discord.com/api/v10"

// 레이드 모집 공고 메시지 전송 (신규 생성)
export async function sendRaidAnnouncement(channelId, raid, hostName, raidId, initialParticipants, trainLabel = null) {
  const token = process.env.DISCORD_BOT_TOKEN

  const supporterSlots = raid.maxPlayers / 4
  const dealerSlots = raid.maxPlayers - supporterSlots
  const totalRounds = raid.totalRounds || 1

  // ── N수 레이드 초기 공고 ──
  if (totalRounds >= 2) {
    const roundFields = Array.from({ length: totalRounds }, (_, i) => {
      const order = i + 1
      const roundData = (raid.rounds || []).find(r => r.order === order)
      const participants = roundData?.participants || []
      const dealers = participants.filter(p => p.role === "dealer")
      const supporters = participants.filter(p => p.role === "support")
      const dealerText = dealers.length > 0
        ? dealers.map(p => p.characterName
            ? `${p.characterName}(${p.characterClass}) Lv.${p.characterLevel}`
            : p.userName).join(", ")
        : "-"
      const supporterText = supporters.length > 0
        ? supporters.map(p => p.characterName
            ? `${p.characterName}(${p.characterClass}) Lv.${p.characterLevel}`
            : p.userName).join(", ")
        : "-"
      return {
        name: `━━ ${order}수 ━━`,
        value: `⚔️ 딜러 (${dealers.length}/${dealerSlots}): ${dealerText}\n🛡️ 서포터 (${supporters.length}/${supporterSlots}): ${supporterText}`,
        inline: false,
      }
    })

    const embed = {
      title: `${raid.raidAlias} ${raid.difficulty}${raid.difficulty_level ? ` (${raid.difficulty_level})` : ""} ${totalRounds}수 모집`,
      description: `${raid.raidName} 공대 모집`,
      color: 0x9B59B6,
      fields: [
        {
          name: "레이드 정보",
          value: `난이도: ${raid.difficulty} | 인원: ${raid.maxPlayers}명 (딜러 ${dealerSlots} / 서포터 ${supporterSlots})\n${totalRounds}수 반복`,
          inline: false,
        },
        ...(!raid.isMobaChul ? [{ name: "일정", value: `${raid.date} ${raid.time}`, inline: false }] : []),
        { name: "주최자", value: hostName, inline: false },
        ...roundFields,
      ],
      footer: { text: `LostArk 레이드 · ID: ${raidId}` },
      timestamp: new Date().toISOString(),
    }

    const components = [
      {
        type: 1,
        components: [
          { type: 2, style: 3, label: "⚔️ 레이드 참가", custom_id: `join_nsu_${raidId}` },
          { type: 2, style: 4, label: "❌ 참가 취소", custom_id: `leave_${raidId}` },
        ],
      },
      {
        type: 1,
        components: [
          { type: 2, style: 2, label: "🚫 모집 취소", custom_id: `cancel_raid_${raidId}` },
          { type: 2, style: 1, label: "📋 참가자 명단", custom_id: `roster_${raidId}` },
        ],
      },
    ]

    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed], components }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    return data.id
  }

  // ── 단일 레이드 초기 공고 ──
  const dealers = initialParticipants.filter(p => p.role === "dealer")
  const supporters = initialParticipants.filter(p => p.role === "support")

  const dealerList = dealers.length > 0
    ? dealers.map(p => {
        const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}${p.characterCombatPower ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}` : ""}` : ""
        return `${p.userName}${charInfo}`
      }).join("\n")
    : "없음"
  const supporterList = supporters.length > 0
    ? supporters.map(p => {
        const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}${p.characterCombatPower ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}` : ""}` : ""
        return `${p.userName}${charInfo}`
      }).join("\n")
    : "없음"

  const embed = {
    title: `${raid.raidAlias} ${raid.difficulty}${raid.difficulty_level ? ` (${raid.difficulty_level})` : ""} 모집`,
    description: `${raid.raidName} 공대 모집`,
    color: 0x9B59B6,
    fields: [
      {
        name: "레이드 정보",
        value: `난이도: ${raid.difficulty} | 인원: ${raid.maxPlayers}명 (딜러 ${dealerSlots} / 서포터 ${supporterSlots})\n출발: ${raid.isMobaChul ? "인원 충족 시 즉시 출발" : "정해진 시간에 출발"}`,
        inline: false
      },
      ...(!raid.isMobaChul ? [{
        name: "일정",
        value: `${raid.date} ${raid.time}`,
        inline: false
      }] : []),
      { name: "주최자", value: hostName, inline: true },
      { name: "딜러", value: `${dealers.length} / ${dealerSlots}`, inline: true },
      { name: "서포터", value: `${supporters.length} / ${supporterSlots}`, inline: true },
      { name: "딜러 목록", value: dealerList, inline: true },
      { name: "서포터 목록", value: supporterList, inline: true },
    ],
    footer: { text: `LostArk 레이드 · ID: ${raidId}` },
    timestamp: new Date().toISOString(),
  }

  const components = [
    {
      type: 1,
      components: [
        { type: 2, style: 3, label: "⚔️ 딜러로 참가", custom_id: `join_dealer_${raidId}`, disabled: dealers.length >= dealerSlots },
        { type: 2, style: 1, label: "🛡️ 서포터로 참가", custom_id: `join_support_${raidId}`, disabled: supporters.length >= supporterSlots },
        { type: 2, style: 4, label: "❌ 참가 취소", custom_id: `leave_${raidId}` },
      ]
    },
    {
      type: 1,
      components: [
        ...(raid.isMobaChul ? [{ type: 2, style: 3, label: "🚀 출발", custom_id: `depart_raid_${raidId}` }] : []),
        { type: 2, style: 2, label: "🚫 모집 취소", custom_id: `cancel_raid_${raidId}` },
        { type: 2, style: 1, label: "📋 참가자 명단", custom_id: `roster_${raidId}` },
      ]
    }
  ]

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed], components }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.id
}

function isExpired(raid) {
  if (raid.isMobaChul) return false
  if (!raid.date || !raid.time) return false
  const raidDateTime = new Date(`${raid.date}T${raid.time}:00+09:00`) // KST
  return new Date() > raidDateTime
}

// 출발 처리 공통 함수: 음성채널 생성 + 참가자 전원 DM 발송
export async function sendDepartDMs(raid) {
  const token = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_GUILD_ID

  const dealers = raid.participants.filter(p => p.role === "dealer")
  const supporters = raid.participants.filter(p => p.role === "support")

  // 1. 음성채널 생성
  let voiceChannelUrl = null
  if (guildId) {
    try {
      const vcRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
        method: "POST",
        headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `⚔️ ${raid.raidAlias} ${raid.difficulty}`,
          type: 2, // GUILD_VOICE
        }),
      })
      if (vcRes.ok) {
        const vcData = await vcRes.json()
        voiceChannelUrl = `https://discord.com/channels/${guildId}/${vcData.id}`
        // DB에 voiceChannelId 저장
        try {
          await connectDB()
          await RaidModel.findByIdAndUpdate(raid._id, { voiceChannelId: vcData.id })
        } catch (e) {
          console.error("voiceChannelId 저장 실패:", e.message)
        }
      } else {
        console.error("음성채널 생성 실패:", vcRes.status)
      }
    } catch (e) {
      console.error("음성채널 생성 오류:", e.message)
    }
  }

  // 2. DM embed 구성
  const dealerList = dealers.length > 0
    ? dealers.map((p, i) => `${i + 1}. ${p.userName}`).join("\n")
    : "없음"
  const supporterList = supporters.length > 0
    ? supporters.map((p, i) => `${i + 1}. ${p.userName}`).join("\n")
    : "없음"

  const embed = {
    title: `${raid.raidAlias} ${raid.difficulty} 출발합니다`,
    description: `${raid.raidName} 파티 출발합니다`,
    color: 0xE67E22,
    fields: [
      { name: "딜러", value: dealerList, inline: true },
      { name: "서포터", value: supporterList, inline: true },
    ],
    footer: { text: "LostArk 레이드 알림" },
    timestamp: new Date().toISOString(),
  }

  const components = voiceChannelUrl ? [{
    type: 1,
    components: [{
      type: 2,
      style: 5, // LINK
      label: "🔊 음성채널 참가",
      url: voiceChannelUrl,
    }],
  }] : []

  // 3. 참가자 전원 + 주최자 DM 발송
  const recipients = [...new Set([raid.hostId, ...raid.participants.map(p => p.userId)])]

  for (const userId of recipients) {
    try {
      const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
        method: "POST",
        headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: userId }),
      })
      if (!dmRes.ok) continue

      const dmChannel = await dmRes.json()
      await fetch(`${DISCORD_API}/channels/${dmChannel.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed], components }),
      })
    } catch (e) {
      console.error(`출발 DM 실패 (userId: ${userId}):`, e.message)
    }
  }
}

// 기차 레이드 통합 모집 공고 (Discord 메시지 1개)
// trainInfo: { trainLabel, maxPlayers, isMobaChul, date, time, raids: [{raidAlias, raidTag, difficulty}] }
// raidId: 단일 Raid 도큐먼트의 _id (기차도 이제 Raid 1개)
export async function sendTrainAnnouncement(channelId, trainInfo, hostName, raidId, initialParticipants) {
  const token = process.env.DISCORD_BOT_TOKEN

  const supporterSlots = trainInfo.maxPlayers / 4
  const dealerSlots = trainInfo.maxPlayers - supporterSlots
  const dealers = initialParticipants.filter(p => p.role === "dealer")
  const supporters = initialParticipants.filter(p => p.role === "support")

  const dealerList = dealers.length > 0
    ? dealers.map(p => {
        const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}${p.characterCombatPower ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}` : ""}` : ""
        return `${p.userName}${charInfo}`
      }).join("\n")
    : "없음"
  const supporterList = supporters.length > 0
    ? supporters.map(p => {
        const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}${p.characterCombatPower ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}` : ""}` : ""
        return `${p.userName}${charInfo}`
      }).join("\n")
    : "없음"

  const raidListText = trainInfo.raids
    .map((r, i) => `${i + 1}. (${r.raidTag}) ${r.raidAlias} ${r.difficulty}`)
    .join("\n")

  const embed = {
    title: `${trainInfo.trainLabel} (${trainInfo.maxPlayers}인)${trainInfo.difficulty_level ? ` (${trainInfo.difficulty_level})` : ""} 모집`,
    description: "공대 모집",
    color: 0x9B59B6,
    fields: [
      { name: "레이드 구성", value: raidListText, inline: false },
      {
        name: "일정",
        value: trainInfo.isMobaChul
          ? "모바출 - 인원 충족 시 즉시 출발"
          : `${trainInfo.date} ${trainInfo.time}`,
        inline: false
      },
      { name: "주최자", value: hostName, inline: true },
      { name: "딜러", value: `${dealers.length} / ${dealerSlots}`, inline: true },
      { name: "서포터", value: `${supporters.length} / ${supporterSlots}`, inline: true },
      { name: "딜러 목록", value: dealerList, inline: true },
      { name: "서포터 목록", value: supporterList, inline: true },
    ],
    footer: { text: `LostArk 레이드 · ID: ${raidId}` },
    timestamp: new Date().toISOString(),
  }

  const components = [
    {
      type: 1,
      components: [
        { type: 2, style: 3, label: "⚔️ 딜러로 참가", custom_id: `join_dealer_${raidId}`, disabled: dealers.length >= dealerSlots },
        { type: 2, style: 1, label: "🛡️ 서포터로 참가", custom_id: `join_support_${raidId}`, disabled: supporters.length >= supporterSlots },
        { type: 2, style: 4, label: "❌ 참가 취소", custom_id: `leave_${raidId}` },
      ]
    },
    {
      type: 1,
      components: [
        ...(trainInfo.isMobaChul ? [{ type: 2, style: 3, label: "🚀 출발", custom_id: `depart_raid_${raidId}` }] : []),
        { type: 2, style: 2, label: "🚫 모집 취소", custom_id: `cancel_raid_${raidId}` },
        { type: 2, style: 1, label: "📋 참가자 명단", custom_id: `roster_${raidId}` },
      ]
    }
  ]

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed], components }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.id
}

// 기차 레이드 Discord 메시지 업데이트 (raid 도큐먼트 객체를 직접 받음)
export async function updateTrainDiscordMessage(raid) {
  if (!raid.discordChannelId || !raid.discordMessageId) return

  const token = process.env.DISCORD_BOT_TOKEN
  const raidId = raid._id.toString()
  const supporterSlots = raid.maxPlayers / 4
  const dealerSlots = raid.maxPlayers - supporterSlots
  const dealers = raid.participants.filter(p => p.role === "dealer")
  const supporters = raid.participants.filter(p => p.role === "support")

  const raidListText = raid.trainRaids?.length > 0
    ? raid.trainRaids
        .sort((a, b) => a.order - b.order)
        .map((r, i) => `${i + 1}. (${r.raidTag}) ${r.raidAlias} ${r.difficulty}`)
        .join("\n")
    : "구성 정보 없음"

  const dealerList = dealers.length > 0
    ? dealers.map(p => {
        const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}${p.characterCombatPower ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}` : ""}` : ""
        return `${p.userName}${charInfo}`
      }).join("\n")
    : "없음"
  const supporterList = supporters.length > 0
    ? supporters.map(p => {
        const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}${p.characterCombatPower ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}` : ""}` : ""
        return `${p.userName}${charInfo}`
      }).join("\n")
    : "없음"

  const embedColor = {
    "모집중":   0x9B59B6,
    "모집완료": 0x3498DB,
    "출발완료": 0xE67E22,
    "취소":     0x95A5A6,
  }

  const label = raid.trainLabel || "N종 레이드"

  const embedData = {
    title: `${label} (${raid.maxPlayers}인)${raid.difficulty_level ? ` (${raid.difficulty_level})` : ""} 모집`,
    description: "공대 모집",
    color: embedColor[raid.status] ?? 0x9B59B6,
    fields: [
      { name: "레이드 구성", value: raidListText, inline: false },
      {
        name: "일정",
        value: raid.isMobaChul
          ? "모바출 - 인원 충족 시 즉시 출발"
          : `${raid.date} ${raid.time}`,
        inline: false
      },
      { name: "주최자", value: raid.hostName, inline: true },
      { name: "딜러", value: `${dealers.length} / ${dealerSlots}`, inline: true },
      { name: "서포터", value: `${supporters.length} / ${supporterSlots}`, inline: true },
      { name: "딜러 목록", value: dealerList, inline: true },
      { name: "서포터 목록", value: supporterList, inline: true },
    ],
    footer: { text: `LostArk 레이드 · ID: ${raidId}` },
    timestamp: new Date().toISOString(),
  }

  let components = []

  if (raid.status !== "출발완료" && raid.status !== "취소") {
    const expired = isExpired(raid)

    const row2 = {
      type: 1,
      components: [
        ...(raid.isMobaChul ? [{
          type: 2, style: 3, label: "🚀 출발",
          custom_id: `depart_raid_${raidId}`, disabled: expired,
        }] : []),
        { type: 2, style: 2, label: "🚫 모집 취소", custom_id: `cancel_raid_${raidId}`, disabled: expired },
        { type: 2, style: 1, label: "📋 참가자 명단", custom_id: `roster_${raidId}` },
      ]
    }

    if (raid.status === "모집완료") {
      components = [
        {
          type: 1,
          components: [
            { type: 2, style: 4, label: "❌ 참가 취소", custom_id: `leave_${raidId}`, disabled: expired },
          ]
        },
        row2,
      ]
    } else {
      components = [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "⚔️ 딜러로 참가", custom_id: `join_dealer_${raidId}`, disabled: expired || dealers.length >= dealerSlots },
            { type: 2, style: 1, label: "🛡️ 서포터로 참가", custom_id: `join_support_${raidId}`, disabled: expired || supporters.length >= supporterSlots },
            { type: 2, style: 4, label: "❌ 참가 취소", custom_id: `leave_${raidId}`, disabled: expired },
          ]
        },
        row2,
      ]
    }
  }

  await fetch(`${DISCORD_API}/channels/${raid.discordChannelId}/messages/${raid.discordMessageId}`, {
    method: "PATCH",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embedData], components }),
  })
}

// ─── TrainRaid 전용 함수 (독립 컬렉션) ──────────────────────────────────────

// TrainRaid Discord 메시지 업데이트 (버튼 custom_id: *_train_{id})
export async function updateTrainRaidDiscordMessage(trainRaid) {
  if (!trainRaid.discordChannelId || !trainRaid.discordMessageId) return

  const token = process.env.DISCORD_BOT_TOKEN
  const id = trainRaid._id.toString()
  const supporterSlots = trainRaid.maxPlayers / 4
  const dealerSlots = trainRaid.maxPlayers - supporterSlots
  const dealers = trainRaid.participants.filter(p => p.role === "dealer")
  const supporters = trainRaid.participants.filter(p => p.role === "support")

  const raidListText = trainRaid.trainRaids?.length > 0
    ? trainRaid.trainRaids
        .sort((a, b) => a.order - b.order)
        .map((r, i) => `${i + 1}. (${r.raidTag}) ${r.raidAlias} ${r.difficulty}`)
        .join("\n")
    : "구성 정보 없음"

  const dealerList = dealers.length > 0
    ? dealers.map(p => {
        const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}${p.characterCombatPower ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}` : ""}` : ""
        return `${p.userName}${charInfo}`
      }).join("\n")
    : "없음"
  const supporterList = supporters.length > 0
    ? supporters.map(p => {
        const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}${p.characterCombatPower ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}` : ""}` : ""
        return `${p.userName}${charInfo}`
      }).join("\n")
    : "없음"

  const embedColor = { "모집중": 0x9B59B6, "모집완료": 0x3498DB, "출발완료": 0xE67E22, "취소": 0x95A5A6 }

  const embedData = {
    title: `${trainRaid.trainLabel} (${trainRaid.maxPlayers}인)${trainRaid.difficulty_level ? ` (${trainRaid.difficulty_level})` : ""} 모집`,
    description: "공대 모집",
    color: embedColor[trainRaid.status] ?? 0x9B59B6,
    fields: [
      { name: "레이드 구성", value: raidListText, inline: false },
      {
        name: "일정",
        value: trainRaid.isMobaChul
          ? "모바출 - 인원 충족 시 즉시 출발"
          : `${trainRaid.date} ${trainRaid.time}`,
        inline: false,
      },
      { name: "주최자",    value: trainRaid.hostName,                          inline: true },
      { name: "딜러",     value: `${dealers.length} / ${dealerSlots}`,        inline: true },
      { name: "서포터",   value: `${supporters.length} / ${supporterSlots}`,  inline: true },
      { name: "딜러 목록",   value: dealerList,   inline: true },
      { name: "서포터 목록", value: supporterList, inline: true },
    ],
    footer: { text: `LostArk 레이드 · ID: ${id}` },
    timestamp: new Date().toISOString(),
  }

  let components = []
  if (trainRaid.status !== "출발완료" && trainRaid.status !== "취소") {
    const expired = isExpired(trainRaid)
    const row2 = {
      type: 1,
      components: [
        ...(trainRaid.isMobaChul ? [{ type: 2, style: 3, label: "🚀 출발", custom_id: `start_raid_train_${id}`, disabled: expired }] : []),
        { type: 2, style: 2, label: "🚫 모집 취소",    custom_id: `cancel_raid_train_${id}`, disabled: expired },
        { type: 2, style: 1, label: "📋 참가자 명단", custom_id: `roster_train_${id}` },
      ],
    }

    if (trainRaid.status === "모집완료") {
      components = [
        { type: 1, components: [{ type: 2, style: 4, label: "❌ 참가 취소", custom_id: `leave_train_${id}`, disabled: expired }] },
        row2,
      ]
    } else {
      components = [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "⚔️ 딜러로 참가",   custom_id: `join_dealer_train_${id}`,  disabled: expired || dealers.length >= dealerSlots },
            { type: 2, style: 1, label: "🛡️ 서포터로 참가", custom_id: `join_support_train_${id}`, disabled: expired || supporters.length >= supporterSlots },
            { type: 2, style: 4, label: "❌ 참가 취소",      custom_id: `leave_train_${id}`,        disabled: expired },
          ],
        },
        row2,
      ]
    }
  }

  await fetch(`${DISCORD_API}/channels/${trainRaid.discordChannelId}/messages/${trainRaid.discordMessageId}`, {
    method: "PATCH",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embedData], components }),
  })
}

// TrainRaid 최초 공고 메시지 전송 (버튼 custom_id: *_train_{id})
export async function sendTrainRaidAnnouncement(channelId, trainRaid) {
  const token = process.env.DISCORD_BOT_TOKEN
  const id = trainRaid._id.toString()
  const supporterSlots = trainRaid.maxPlayers / 4
  const dealerSlots = trainRaid.maxPlayers - supporterSlots

  const dealers = (trainRaid.participants || []).filter(p => p.role === "dealer")
  const supporters = (trainRaid.participants || []).filter(p => p.role === "support")

  const dealerList = dealers.length > 0
    ? dealers.map(p => {
        const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}${p.characterCombatPower ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}` : ""}` : ""
        return `${p.userName}${charInfo}`
      }).join("\n")
    : "없음"
  const supporterList = supporters.length > 0
    ? supporters.map(p => {
        const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}${p.characterCombatPower ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}` : ""}` : ""
        return `${p.userName}${charInfo}`
      }).join("\n")
    : "없음"

  const raidListText = trainRaid.trainRaids?.length > 0
    ? trainRaid.trainRaids
        .sort((a, b) => a.order - b.order)
        .map((r, i) => `${i + 1}. (${r.raidTag}) ${r.raidAlias} ${r.difficulty}`)
        .join("\n")
    : "구성 정보 없음"

  const embed = {
    title: `${trainRaid.trainLabel} (${trainRaid.maxPlayers}인)${trainRaid.difficulty_level ? ` (${trainRaid.difficulty_level})` : ""} 모집`,
    description: "공대 모집",
    color: 0x9B59B6,
    fields: [
      { name: "레이드 구성", value: raidListText, inline: false },
      {
        name: "일정",
        value: trainRaid.isMobaChul
          ? "모바출 - 인원 충족 시 즉시 출발"
          : `${trainRaid.date} ${trainRaid.time}`,
        inline: false,
      },
      { name: "주최자",  value: trainRaid.hostName,                          inline: true },
      { name: "딜러",   value: `${dealers.length} / ${dealerSlots}`,        inline: true },
      { name: "서포터", value: `${supporters.length} / ${supporterSlots}`,  inline: true },
      { name: "딜러 목록",   value: dealerList,   inline: true },
      { name: "서포터 목록", value: supporterList, inline: true },
    ],
    footer: { text: `LostArk 레이드 · ID: ${id}` },
    timestamp: new Date().toISOString(),
  }

  const row1 = {
    type: 1,
    components: [
      { type: 2, style: 3, label: "⚔️ 딜러로 참가",   custom_id: `join_dealer_train_${id}` },
      { type: 2, style: 1, label: "🛡️ 서포터로 참가", custom_id: `join_support_train_${id}` },
      { type: 2, style: 4, label: "❌ 참가 취소",      custom_id: `leave_train_${id}` },
    ],
  }
  const row2 = {
    type: 1,
    components: [
      ...(trainRaid.isMobaChul ? [{ type: 2, style: 3, label: "🚀 출발", custom_id: `start_raid_train_${id}` }] : []),
      { type: 2, style: 2, label: "🚫 모집 취소",    custom_id: `cancel_raid_train_${id}` },
      { type: 2, style: 1, label: "📋 참가자 명단", custom_id: `roster_train_${id}` },
    ],
  }

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed], components: [row1, row2] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.id
}

// ─────────────────────────────────────────────────────────────────────────────

// N수 레이드 Discord 메시지 업데이트
async function updateNsuDiscordMessage(raid) {
  const token = process.env.DISCORD_BOT_TOKEN
  const raidId = raid._id.toString()
  const supporterSlots = raid.maxPlayers / 4
  const dealerSlots = raid.maxPlayers - supporterSlots

  const embedColor = {
    "모집중":   0x9B59B6,
    "모집완료": 0x3498DB,
    "취소":     0x95A5A6,
  }

  const roundFields = (raid.rounds || []).map(round => {
    const d = round.participants.filter(p => p.role === "dealer")
    const s = round.participants.filter(p => p.role === "support")
    const dealerText = d.length > 0
      ? d.map(p => p.characterName ? `${p.characterName}(${p.characterClass}) Lv.${p.characterLevel}` : p.userName).join(", ")
      : "-"
    const supporterText = s.length > 0
      ? s.map(p => p.characterName ? `${p.characterName}(${p.characterClass}) Lv.${p.characterLevel}` : p.userName).join(", ")
      : "-"
    return {
      name: `━━ ${round.order}수 ━━`,
      value: `⚔️ 딜러 (${d.length}/${dealerSlots}): ${dealerText}\n🛡️ 서포터 (${s.length}/${supporterSlots}): ${supporterText}`,
      inline: false,
    }
  })

  const embedData = {
    title: `${raid.raidAlias} ${raid.difficulty}${raid.difficulty_level ? ` (${raid.difficulty_level})` : ""} ${raid.totalRounds}수 모집`,
    description: `${raid.raidName} 공대 모집`,
    color: embedColor[raid.status] ?? 0x9B59B6,
    fields: [
      {
        name: "레이드 정보",
        value: `난이도: ${raid.difficulty} | 인원: ${raid.maxPlayers}명 (딜러 ${dealerSlots} / 서포터 ${supporterSlots})\n${raid.totalRounds}수 반복`,
        inline: false,
      },
      ...(!raid.isMobaChul ? [{ name: "일정", value: `${raid.date} ${raid.time}`, inline: false }] : []),
      { name: "주최자", value: raid.hostName, inline: false },
      ...roundFields,
    ],
    footer: { text: `LostArk 레이드 · ID: ${raidId}` },
    timestamp: new Date().toISOString(),
  }

  let components = []
  if (raid.status !== "취소") {
    const expired = isExpired(raid)
    const isFull = raid.status === "모집완료"
    components = [
      {
        type: 1,
        components: [
          ...(!isFull ? [{ type: 2, style: 3, label: "⚔️ 레이드 참가", custom_id: `join_nsu_${raidId}`, disabled: expired }] : []),
          { type: 2, style: 4, label: "❌ 참가 취소", custom_id: `leave_${raidId}`, disabled: expired },
        ],
      },
      {
        type: 1,
        components: [
          { type: 2, style: 2, label: "🚫 모집 취소", custom_id: `cancel_raid_${raidId}`, disabled: expired },
          { type: 2, style: 1, label: "📋 참가자 명단", custom_id: `roster_${raidId}` },
        ],
      },
    ]
  }

  await fetch(`${DISCORD_API}/channels/${raid.discordChannelId}/messages/${raid.discordMessageId}`, {
    method: "PATCH",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embedData], components }),
  })
}

export async function updateDiscordMessage(raid) {
  if (!raid.discordChannelId || !raid.discordMessageId) return

  // isTrain 레이드는 전용 함수로 처리
  if (raid.isTrain) return updateTrainDiscordMessage(raid)

  // N수 레이드는 전용 함수로 처리
  if (raid.totalRounds >= 2) return updateNsuDiscordMessage(raid)

  const token = process.env.DISCORD_BOT_TOKEN
  const supporterSlots = raid.maxPlayers / 4
  const dealerSlots = raid.maxPlayers - supporterSlots
  const dealers = raid.participants.filter(p => p.role === "dealer")
  const supporters = raid.participants.filter(p => p.role === "support")

  // 참가자 목록 텍스트 생성
  const dealerList = dealers.length > 0
    ? dealers.map(p => {
        const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}${p.characterCombatPower ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}` : ""}` : ""
        return `${p.userName}${charInfo}`
      }).join("\n")
    : "없음"
  const supporterList = supporters.length > 0
    ? supporters.map(p => {
        const charInfo = p.characterName ? ` : (${p.characterClass}) ${p.characterName} Lv.${p.characterLevel}${p.characterCombatPower ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}` : ""}` : ""
        return `${p.userName}${charInfo}`
      }).join("\n")
    : "없음"

  const embedColor = {
    "모집중":   0x9B59B6,
    "모집완료": 0x3498DB,
    "출발완료": 0xE67E22,
    "취소":     0x95A5A6,
  }

  const embedData = {
    title: `${raid.raidAlias} ${raid.difficulty}${raid.difficulty_level ? ` (${raid.difficulty_level})` : ""} 모집`,
    description: `${raid.raidName} 공대 모집`,
    color: embedColor[raid.status] ?? 0x9B59B6,
    fields: [
      {
        name: "레이드 정보",
        value: `난이도: ${raid.difficulty} | 인원: ${raid.maxPlayers}명 (딜러 ${dealerSlots} / 서포터 ${supporterSlots})\n출발: ${raid.isMobaChul ? "인원 충족 시 즉시 출발" : "정해진 시간에 출발"}`,
        inline: false
      },
      ...(!raid.isMobaChul ? [{
        name: "일정",
        value: `${raid.date} ${raid.time}`,
        inline: false
      }] : []),
      { name: "주최자", value: raid.hostName, inline: true },
      { name: "딜러", value: `${dealers.length} / ${dealerSlots}`, inline: true },
      { name: "서포터", value: `${supporters.length} / ${supporterSlots}`, inline: true },
      { name: "딜러 목록", value: dealerList, inline: true },
      { name: "서포터 목록", value: supporterList, inline: true },
    ],
    footer: { text: `LostArk 레이드 · ID: ${raid._id}` },
    timestamp: new Date().toISOString(),
  }

  // ── 버튼 구성 ──────────────────────────────────────────────────────────
  // 출발완료 · 취소: 버튼 없음
  let components = []

  if (raid.status !== "출발완료" && raid.status !== "취소") {
    const expired = isExpired(raid)

    // Row 2: 모바출 레이드엔 🚀 출발 버튼 포함
    const row2 = {
      type: 1,
      components: [
        ...(raid.isMobaChul ? [{
          type: 2, style: 3, label: "🚀 출발",
          custom_id: `depart_raid_${raid._id}`, disabled: expired,
        }] : []),
        { type: 2, style: 2, label: "🚫 모집 취소", custom_id: `cancel_raid_${raid._id}`, disabled: expired },
        { type: 2, style: 1, label: "📋 참가자 명단", custom_id: `roster_${raid._id}` },
      ]
    }

    if (raid.status === "모집완료") {
      components = [
        {
          type: 1,
          components: [
            { type: 2, style: 4, label: "❌ 참가 취소", custom_id: `leave_${raid._id}`, disabled: expired },
          ]
        },
        row2,
      ]
    } else {
      // 모집중
      components = [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "⚔️ 딜러로 참가", custom_id: `join_dealer_${raid._id}`, disabled: expired || dealers.length >= dealerSlots },
            { type: 2, style: 1, label: "🛡️ 서포터로 참가", custom_id: `join_support_${raid._id}`, disabled: expired || supporters.length >= supporterSlots },
            { type: 2, style: 4, label: "❌ 참가 취소", custom_id: `leave_${raid._id}`, disabled: expired },
          ]
        },
        row2,
      ]
    }
  }

  const patchRes = await fetch(`${DISCORD_API}/channels/${raid.discordChannelId}/messages/${raid.discordMessageId}`, {
    method: "PATCH",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embedData], components }),
  })
  console.log("Discord 메시지 업데이트:", patchRes.status)
}
