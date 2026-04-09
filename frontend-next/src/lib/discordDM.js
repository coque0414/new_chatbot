const DISCORD_API = "https://discord.com/api/v10"

/**
 * 레이드 DM 발송 (임베드 + 버튼)
 * @param {string} recipientId - Discord 유저 ID
 * @param {object} embed - Discord embed 객체
 * @param {object} opts
 * @param {string|null} opts.voiceChannelId - 음성채널 ID
 * @param {string|null} opts.guildId - 길드 ID
 * @param {boolean} opts.isHost - 주최자 여부 (삭제 버튼 표시)
 * @param {string} opts.raidId - 레이드 ID (삭제 버튼 custom_id)
 */
export async function sendRaidDM(recipientId, embed, { voiceChannelId, guildId, isHost, raidId }) {
  const token = process.env.DISCORD_BOT_TOKEN

  const buttonRow = []
  if (voiceChannelId && guildId) {
    buttonRow.push({
      type: 2,
      style: 5, // LINK
      label: "🔊 음성채널 입장",
      url: `https://discord.com/channels/${guildId}/${voiceChannelId}`,
    })
  }
  if (isHost && voiceChannelId) {
    buttonRow.push({
      type: 2,
      style: 4, // DANGER
      label: "🔇 음성채널 삭제",
      custom_id: `delete_voice_${raidId}`,
    })
  }

  const components = buttonRow.length > 0 ? [{ type: 1, components: buttonRow }] : []

  const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: recipientId }),
  })
  if (!dmRes.ok) throw new Error(`DM 채널 생성 실패: ${dmRes.status}`)

  const dmChannel = await dmRes.json()
  const msgRes = await fetch(`${DISCORD_API}/channels/${dmChannel.id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed], components }),
  })
  if (!msgRes.ok) throw new Error(`메시지 발송 실패: ${msgRes.status}`)
}

/**
 * 레이드 출발 임베드 생성 (launchRaid용)
 */
export function buildLaunchEmbed(raid) {
  const dealers = raid.participants.filter(p => p.role === "dealer")
  const supporters = raid.participants.filter(p => p.role === "support")

  const dealerList = dealers.length > 0
    ? dealers.map((p, i) => `${i + 1}. ⚔️ ${p.userName}`).join("\n")
    : "없음"
  const supporterList = supporters.length > 0
    ? supporters.map((p, i) => `${i + 1}. 🛡️ ${p.userName}`).join("\n")
    : "없음"

  const title = raid.isTrain
    ? `⚔️ ${raid.trainLabel} 레이드가 곧 시작됩니다!`
    : `⚔️ ${raid.raidAlias} ${raid.difficulty} 레이드가 곧 시작됩니다!`
  const description = raid.isTrain
    ? "기차 레이드 파티가 지금 출발합니다!"
    : `**${raid.raidName}** 파티가 지금 출발합니다!`
  const trainRaidsField = raid.isTrain && raid.trainRaids?.length > 0
    ? [{
        name: "📋 레이드 구성",
        value: raid.trainRaids
          .sort((a, b) => a.order - b.order)
          .map((r, i) => `${i + 1}. (${r.raidTag}) ${r.raidAlias} ${r.difficulty}`)
          .join("\n"),
        inline: false,
      }]
    : []

  return {
    title,
    description,
    color: 0x9B59B6,
    fields: [
      ...trainRaidsField,
      {
        name: "📅 시작",
        value: raid.isMobaChul ? "⚡ 모바출" : `${raid.date} ${raid.time}`,
        inline: true,
      },
      { name: "👑 주최자", value: raid.hostName, inline: true },
      { name: "⚔️ 딜러", value: dealerList, inline: false },
      { name: "🛡️ 서포터", value: supporterList, inline: false },
    ],
    footer: { text: "LostArk Guide · 레이드 알림" },
    timestamp: new Date().toISOString(),
  }
}

/**
 * 기차 레이드 출발 임베드 생성 (TrainRaid 전용)
 */
export function buildTrainRaidLaunchEmbed(trainRaid) {
  const dealers = trainRaid.participants.filter(p => p.role === "dealer")
  const supporters = trainRaid.participants.filter(p => p.role === "support")

  const dealerList = dealers.length > 0
    ? dealers.map((p, i) => `${i + 1}. ⚔️ ${p.userName}`).join("\n")
    : "없음"
  const supporterList = supporters.length > 0
    ? supporters.map((p, i) => `${i + 1}. 🛡️ ${p.userName}`).join("\n")
    : "없음"

  const raidListText = trainRaid.trainRaids?.length > 0
    ? trainRaid.trainRaids
        .sort((a, b) => a.order - b.order)
        .map((r, i) => `${i + 1}. (${r.raidTag}) ${r.raidAlias} ${r.difficulty}`)
        .join("\n")
    : "구성 정보 없음"

  return {
    title: `⚔️ ${trainRaid.trainLabel} 레이드가 곧 시작됩니다!`,
    description: "기차 레이드 파티가 지금 출발합니다!",
    color: 0x9B59B6,
    fields: [
      { name: "📋 레이드 구성", value: raidListText, inline: false },
      {
        name: "📅 시작",
        value: trainRaid.isMobaChul ? "⚡ 모바출" : `${trainRaid.date} ${trainRaid.time}`,
        inline: true,
      },
      { name: "👑 주최자", value: trainRaid.hostName, inline: true },
      { name: "⚔️ 딜러", value: dealerList, inline: false },
      { name: "🛡️ 서포터", value: supporterList, inline: false },
    ],
    footer: { text: "LostArk Guide · 기차 레이드 출발 알림" },
    timestamp: new Date().toISOString(),
  }
}

/**
 * 레이드 N분 전 알림 임베드 생성 (scheduler용)
 */
export function buildNotifyEmbed(raid) {
  const dealers = raid.participants.filter(p => p.role === "dealer")
  const supporters = raid.participants.filter(p => p.role === "support")
  const notifyMin = raid.notifyMinutesBefore ?? 30

  const dealerList = dealers.length > 0
    ? dealers.map(p => p.userName).join(", ")
    : "없음"
  const supporterList = supporters.length > 0
    ? supporters.map(p => p.userName).join(", ")
    : "없음"

  const title = raid.isTrain
    ? `⏰ ${raid.trainLabel} ${notifyMin}분 전 알림!`
    : `⏰ ${raid.raidAlias} ${raid.difficulty} 레이드 ${notifyMin}분 전 알림!`
  const trainRaidsField = raid.isTrain && raid.trainRaids?.length > 0
    ? [{
        name: "📋 레이드 구성",
        value: raid.trainRaids
          .sort((a, b) => a.order - b.order)
          .map((r, i) => `${i + 1}. (${r.raidTag}) ${r.raidAlias} ${r.difficulty}`)
          .join("\n"),
        inline: false,
      }]
    : []

  return {
    title,
    color: 0x9B59B6,
    fields: [
      ...trainRaidsField,
      { name: "📅 시작", value: `${raid.date} ${raid.time}`, inline: true },
      { name: "👑 주최자", value: raid.hostName, inline: true },
      { name: "⚔️ 딜러", value: dealerList, inline: false },
      { name: "🛡️ 서포터", value: supporterList, inline: false },
    ],
    footer: { text: "LostArk Guide · 레이드 알림" },
    timestamp: new Date().toISOString(),
  }
}
