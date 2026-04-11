import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"
import { sendRaidAnnouncement, sendTrainAnnouncement } from "@/lib/discord"

// 레이드 예약 생성
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      raidName, raidAlias, raidTag, difficulty,
      maxPlayers, date, time, isMobaChul, discordChannelId, guildId,
      hostRole,      // "dealer" | "support" | "none"
      hostCharacter, // { name, class, level, combatPower } | null
      trains,        // N종 기차 모드: 레이드 배열
    } = body

    await connectDB()

    const hostUserId = session.user.discordId || session.user.id

    // ===== N종 기차 모드 =====
    if (trains && Array.isArray(trains) && trains.length >= 2) {
      const trainLabelText = body.trainLabel || `${trains.length}종 기차`

      const participants = hostRole && hostRole !== "none" ? [{
        userId: hostUserId,
        userName: session.user.name,
        userImage: session.user.image,
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
        discordChannelId,
        guildId,
        hostId: hostUserId,
        hostName: session.user.name,
        hostImage: session.user.image,
        participants,
        status: "모집중",
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
            session.user.name,
            raid._id.toString(),
            participants
          )
          await Raid.findByIdAndUpdate(raid._id, { discordMessageId })
        } catch (e) {
          console.error("기차 Discord 메시지 전송 실패:", e)
        }
      }

      return Response.json({ success: true, raid })
    }

    // ===== 단일 레이드 모드 =====
    const participants = hostRole && hostRole !== "none" ? [{
      userId: hostUserId,
      userName: session.user.name,
      userImage: session.user.image,
      role: hostRole,
      characterName:        hostCharacter?.name        || null,
      characterClass:       hostCharacter?.class       || null,
      characterLevel:       hostCharacter?.level       || null,
      characterCombatPower: hostCharacter?.combatPower || null,
    }] : []

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
      discordChannelId,
      guildId,
      hostId: hostUserId,
      hostName: session.user.name,
      hostImage: session.user.image,
      participants,
      status: "모집중",
    })

    // 2. Discord 메시지 전송
    if (discordChannelId) {
      try {
        const discordMessageId = await sendRaidAnnouncement(
          discordChannelId,
          { raidName, raidAlias, difficulty, maxPlayers, date, time, isMobaChul },
          session.user.name,
          raid._id.toString(),
          participants
        )
        await Raid.findByIdAndUpdate(raid._id, { discordMessageId })
      } catch (e) {
        console.error("Discord 메시지 전송 실패:", e)
      }
    }

    return Response.json({ success: true, raid })

  } catch (error) {
    console.error(error)
    console.error("레이드 생성 오류:", error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// 레이드 목록 조회
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const guildId = searchParams.get("guildId")
    const statusFilter = searchParams.get("status")

    const userId = session.user.discordId || session.user.id

    // 내가 만든 레이드 (기차/단일 모두 포함, 기한 지난 것도 포함)
    if (type === "my") {
      const raids = await Raid.find({ hostId: userId }).sort({ createdAt: -1 }).limit(50)
      return Response.json({ raids })
    }

    // 현재 시각을 KST(UTC+9) 기준 "YYYY-MM-DD HH:MM" 문자열로 변환
    const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000)
    const currentDateTime = nowKST.toISOString().slice(0, 16).replace("T", " ")

    // 지난 레이드 숨김 필터:
    // - 모바출(isMobaChul: true) + 모집중 → 날짜 무관 표시
    // - 그 외 → date + " " + time >= 현재 시각인 경우만 표시
    const timeFilter = {
      $expr: {
        $or: [
          { $and: [{ $eq: ["$isMobaChul", true] }, { $eq: ["$status", "모집중"] }] },
          { $gte: [{ $concat: ["$date", " ", "$time"] }, currentDateTime] },
        ],
      },
    }

    let query = { ...timeFilter }

    if (type === "joined") {
      query["participants.userId"] = userId
      const raids = await Raid.find(query).sort({ createdAt: -1 }).limit(200)
      return Response.json({ raids })
    } else if (guildId) {
      query.guildId = guildId
      if (statusFilter === "active") {
        query.status = { $in: ["모집중", "모집완료"] }
      }
    }

    const raids = await Raid.find(query).sort({ createdAt: -1 }).limit(20)
    return Response.json({ raids })

  } catch (error) {
    console.error(error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
