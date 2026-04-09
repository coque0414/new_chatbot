import { connectDB } from "@/lib/mongodb"
import RaidModel from "@/lib/models/Raid"
import { updateDiscordMessage, updateTrainDiscordMessage } from "@/lib/discord"
import { sendRaidDM, buildLaunchEmbed } from "@/lib/discordDM"

const DISCORD_API = "https://discord.com/api/v10"

/**
 * 레이드 출발 처리 공통 함수
 * interactions/route.js (버튼 클릭) 및 추후 스케줄러에서 재사용 가능.
 *
 * 음성채널 자동 삭제 전략:
 *
 *   방식 A (현재 구현) — 시간 기반 스케줄러:
 *     raid.voiceChannelCreatedAt을 저장해두고,
 *     /api/scheduler/check 에서 매 5분마다 아래 쿼리로 처리:
 *       Raid.find({ voiceChannelId: { $ne: null }, voiceChannelCreatedAt: { $lte: threeHoursAgo } })
 *       → DELETE /channels/{voiceChannelId} 후 voiceChannelId: null, voiceChannelCreatedAt: null 저장
 *
 *   방식 B (현재 구현) — 주최자 수동 삭제:
 *     출발 DM에서 주최자에게만 [🔇 음성채널 삭제] 버튼 표시.
 *     interactions/route.js의 delete_voice_{raidId} 핸들러가 처리.
 *
 *   방식 C (미구현, 메모) — 실시간 인원 감지:
 *     Discord Gateway WebSocket의 VOICE_STATE_UPDATE 이벤트로
 *     채널 인원이 0이 되는 순간 즉시 삭제할 수 있음.
 *     현재 프로젝트는 서버리스 REST API 전용 구조라 Gateway 연결이 없어 불가.
 *     향후 별도 Node.js 상시 실행 프로세스 추가 시 구현 가능.
 */
export async function launchRaid(raid) {
  const token = process.env.DISCORD_BOT_TOKEN

  // 1. guildId 확인 (없으면 채널 API로 조회)
  let guildId = raid.guildId
  if (!guildId && raid.discordChannelId) {
    try {
      const chRes = await fetch(`${DISCORD_API}/channels/${raid.discordChannelId}`, {
        headers: { Authorization: `Bot ${token}` },
      })
      if (chRes.ok) {
        const chData = await chRes.json()
        guildId = chData.guild_id
      }
    } catch (e) {
      console.error("채널에서 guildId 조회 실패:", e.message)
    }
  }

  // 2. 임시 음성채널 생성
  let voiceChannelId = null
  const voiceChannelCreatedAt = new Date()

  if (guildId) {
    try {
      const vcRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
        method: "POST",
        headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: raid.isTrain ? `⚔️ ${raid.trainLabel || "기차"}` : `⚔️ ${raid.raidAlias} ${raid.difficulty}`,
          type: 2, // GUILD_VOICE
          user_limit: raid.maxPlayers,
        }),
      })

      if (vcRes.ok) {
        const vcData = await vcRes.json()
        voiceChannelId = vcData.id
      } else {
        const errData = await vcRes.json().catch(() => ({}))
        console.error("음성채널 생성 실패:", vcRes.status, errData.message || "")
      }
    } catch (e) {
      console.error("음성채널 생성 오류:", e.message)
    }
  }

  // 3. DM 순차 발송 (Discord rate limit 방지)
  const embed = buildLaunchEmbed(raid)
  const raidId = raid._id.toString()
  const recipients = [...new Set([raid.hostId, ...raid.participants.map(p => p.userId)])]

  for (const recipientId of recipients) {
    try {
      const isHost = recipientId === raid.hostId
      await sendRaidDM(recipientId, embed, { voiceChannelId, guildId, isHost, raidId })
    } catch (e) {
      // DM 수신 거부 등 개별 실패 무시, 다음 참가자 진행
      console.error(`출발 DM 실패 (userId: ${recipientId}):`, e.message)
    }
    await new Promise(r => setTimeout(r, 500))
  }

  // 5. DB 상태 업데이트
  await connectDB()
  await RaidModel.findByIdAndUpdate(raid._id, {
    status: "출발완료",
    dmSent: true,
    ...(voiceChannelId ? { voiceChannelId, voiceChannelCreatedAt } : {}),
    // guildId가 raid에 없었으면 이때 저장
    ...(guildId && !raid.guildId ? { guildId } : {}),
  })

  // 6. Discord 원본 모집 메시지 버튼 전체 제거
  const updatedRaid = await RaidModel.findById(raid._id)
  if (updatedRaid.isTrain) {
    await updateTrainDiscordMessage(updatedRaid)
  } else {
    await updateDiscordMessage(updatedRaid)
  }
}
