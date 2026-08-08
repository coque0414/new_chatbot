import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"
import { sendRaidAnnouncement, sendTrainAnnouncement } from "@/lib/discord"

/**
 * 레이드(단일 / N종 기차 / N수 주최자) 예약을 생성하고 Discord 채널에
 * 모집 공고 메시지를 전송한다.
 *
 * app/api/raids/route.js의 POST 핸들러가 request body 파싱 + 세션 검증 +
 * rate limit/주간 생성 횟수 제한 체크까지 마친 뒤 호출하며, 추후
 * "대화형 에이전트" 기능에서도 동일한 입력 형태로 재사용될 예정이다.
 *
 * @param {Object} params
 * @param {string} params.hostId - 주최자 Discord ID. 호출부에서 `session.user.discordId || session.user.id`로 파생.
 * @param {string} params.hostName - 주최자 표시 이름. 호출부에서 `session.user.name`으로 파생.
 * @param {string} params.hostImage - 주최자 프로필 이미지 URL. 호출부에서 `session.user.image`로 파생.
 * @param {string} params.raidName - 레이드 이름 (기차 모드에서는 trains[0] 기준으로 대체됨).
 * @param {string} params.raidAlias - 레이드 약칭 (기차 모드에서는 trains[0] 기준으로 대체됨).
 * @param {string} params.raidTag - 레이드 태그 (기차 모드에서는 trains[0] 기준으로 대체됨).
 * @param {string} params.difficulty - 난이도 (기차 모드에서는 trains[0] 기준으로 대체됨).
 * @param {number} params.maxPlayers - 최대 인원.
 * @param {string} params.date - 날짜 문자열 (모바출이면 빈 문자열 허용).
 * @param {string} params.time - 시간 문자열 (모바출이면 빈 문자열 허용).
 * @param {boolean} [params.isMobaChul] - 모바일 출발(날짜 무관 상시 모집) 여부.
 * @param {string} [params.discordChannelId] - Discord 공고를 전송할 채널 ID. 없으면 DB 저장만 하고 Discord 전송은 생략.
 * @param {string} [params.guildId] - Discord 길드(서버) ID.
 * @param {"dealer"|"support"|"none"} [params.hostRole] - 주최자 참가 역할. 호출부(웹 폼/에이전트)가 UI 상 선택값을 그대로 전달하며, "none"이거나 미지정이면 participants에 포함되지 않는다.
 * @param {{name?: string, class?: string, level?: string|number, combatPower?: string|number}|null} [params.hostCharacter] - 단일/기차 모드에서 주최자 캐릭터 정보.
 * @param {Object<string, {name?: string, class?: string, level?: string|number, combatPower?: string|number}>|null} [params.hostNsuCharacters] - N수(totalRounds >= 2) 모드에서 라운드(order)별 주최자 캐릭터.
 * @param {Object<string, "dealer"|"support">|null} [params.hostNsuRoles] - N수 모드에서 라운드(order)별 주최자 역할.
 * @param {string|null} [params.difficultyLevel] - "헤딩"|"트라이"|"클경"|"반숙"|"숙련"|"숙제"|null.
 * @param {Array<Object>|null} [params.trains] - 길이 2 이상이면 N종 기차 모드로 처리된다.
 * @param {string} [params.trainLabel] - 기차 모드 표시 라벨. 미지정 시 "{trains.length}종 기차".
 * @param {10|20|30} [params.notifyMinutesBefore] - 출발 N분 전 알림 시각. 호출부에서 유효값(10/20/30)으로 정규화해 전달.
 * @param {1|2|3|4} [params.totalRounds=1] - 단일 레이드 모드에서 N수 라운드 수. 2 이상이면 top-level participants는 비우고 rounds에만 주최자를 채운다.
 * @returns {Promise<Object>} 생성된 Raid 문서 (discordMessageId 포함).
 */
export async function createRaid({
  hostId, hostName, hostImage,
  raidName, raidAlias, raidTag, difficulty, maxPlayers,
  date, time, isMobaChul,
  discordChannelId, guildId,
  hostRole,
  hostCharacter,
  hostNsuCharacters,
  hostNsuRoles,
  difficultyLevel,
  trains,
  trainLabel,
  notifyMinutesBefore,
  totalRounds = 1,
}) {
  await connectDB()

  // ===== N종 기차 모드 =====
  if (trains && Array.isArray(trains) && trains.length >= 2) {
    const trainLabelText = trainLabel || `${trains.length}종 기차`

    const participants = hostRole && hostRole !== "none" ? [{
      userId: hostId,
      userName: hostName,
      userImage: hostImage,
      role: hostRole,
      characterName:        hostCharacter?.name        || null,
      characterClass:       hostCharacter?.class       || null,
      characterLevel:       hostCharacter?.level       || null,
      characterCombatPower: hostCharacter?.combatPower || null,
    }] : []

    // 기차 전체를 Raid 1개 도큐먼트로 저장
    const raid = await Raid.create({
      // 대표 정보 (첫 번째 레이드 기준)
      raidName: trains[0].raidName,
      raidAlias: trains[0].raidAlias,
      raidTag: trains[0].raidTag,
      difficulty: trains[0].difficulty,
      maxPlayers,
      date: date || "",
      time: time || "",
      isMobaChul: isMobaChul || false,
      difficulty_level: difficultyLevel || null,
      discordChannelId,
      guildId,
      hostId,
      hostName,
      hostImage,
      participants,
      status: "모집중",
      notifyMinutesBefore,
      // 기차 전용 필드
      isTrain: true,
      trainLabel: trainLabelText,
      trainRaids: trains.map((t, i) => ({
        raidAlias: t.raidAlias,
        raidTag: t.raidTag,
        raidName: t.raidName,
        difficulty: t.difficulty,
        maxPlayers: t.maxPlayers || maxPlayers,
        order: i + 1,
      })),
    })

    // Discord 메시지 전송
    if (discordChannelId) {
      try {
        const discordMessageId = await sendTrainAnnouncement(
          discordChannelId,
          {
            trainLabel: trainLabelText,
            maxPlayers,
            isMobaChul: isMobaChul || false,
            date: date || "",
            time: time || "",
            raids: trains.map(t => ({ raidAlias: t.raidAlias, raidTag: t.raidTag, difficulty: t.difficulty })),
          },
          hostName,
          raid._id.toString(),
          participants
        )
        await Raid.findByIdAndUpdate(raid._id, { discordMessageId })
      } catch (e) {
        console.error("기차 Discord 메시지 전송 실패:", e)
      }
    }

    return raid
  }

  // ===== 단일 레이드 모드 =====
  const participants = hostRole && hostRole !== "none" ? [{
    userId: hostId,
    userName: hostName,
    userImage: hostImage,
    role: hostRole,
    characterName:        hostCharacter?.name        || null,
    characterClass:       hostCharacter?.class       || null,
    characterLevel:       hostCharacter?.level       || null,
    characterCombatPower: hostCharacter?.combatPower || null,
  }] : []

  // N수 주최자 rounds 구성
  const buildRounds = () => {
    if (totalRounds < 2) return []
    return Array.from({ length: totalRounds }, (_, i) => {
      const order = i + 1
      const roundParticipants = []
      const hc = hostNsuCharacters?.[order]
      if (hc?.name) {
        const role = hostNsuRoles?.[order] || "dealer"
        roundParticipants.push({
          userId: hostId,
          userName: hostName,
          userImage: hostImage,
          role,
          characterName: hc.name || null,
          characterClass: hc.class || null,
          characterLevel: hc.level || null,
          characterCombatPower: hc.combatPower || null,
        })
      }
      return { order, participants: roundParticipants }
    })
  }

  // N수이고 주최자가 있으면 top-level participants는 비움 (rounds에만 추가)
  const topParticipants = totalRounds >= 2 ? [] : participants

  // 1. MongoDB 먼저 저장
  const raid = await Raid.create({
    raidName,
    raidAlias,
    raidTag,
    difficulty,
    maxPlayers,
    date,
    time,
    isMobaChul: isMobaChul || false,
    difficulty_level: difficultyLevel || null,
    discordChannelId,
    guildId,
    hostId,
    hostName,
    hostImage,
    participants: topParticipants,
    status: "모집중",
    notifyMinutesBefore,
    totalRounds,
    rounds: buildRounds(),
  })

  // 2. Discord 메시지 전송
  if (discordChannelId) {
    try {
      const discordMessageId = await sendRaidAnnouncement(
        discordChannelId,
        { raidName, raidAlias, difficulty, maxPlayers, date, time, isMobaChul, totalRounds, difficulty_level: difficultyLevel || null, rounds: buildRounds() },
        hostName,
        raid._id.toString(),
        participants
      )
      await Raid.findByIdAndUpdate(raid._id, { discordMessageId })
    } catch (e) {
      console.error("Discord 메시지 전송 실패:", e)
    }
  }

  return raid
}
