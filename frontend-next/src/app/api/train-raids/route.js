import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"
import { sendTrainRaidAnnouncement } from "@/lib/discord"
import { getTrainPreset } from "@/lib/trainData"

// 기차 레이드 생성 (POST /api/train-raids)
// ※ 웹 폼에서 호출 — Raid 컬렉션에 isTrain:true 로 저장
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { trainKey, maxPlayers, isMobaChul, date, time, discordChannelId, guildId, hostRole, hostCharacter } = body

    if (!trainKey) return Response.json({ error: "trainKey가 필요합니다." }, { status: 400 })

    const preset = getTrainPreset(trainKey)
    if (!preset) return Response.json({ error: "알 수 없는 기차 구성입니다." }, { status: 400 })

    await connectDB()

    const hostUserId = session.user.discordId || session.user.id
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

    const firstRaid = preset.raids[0]
    const trainRaid = await Raid.create({
      // 기차 전용 필드
      isTrain:    true,
      trainKey,
      trainLabel: preset.trainLabel,
      trainRaids: preset.raids.map((r, i) => ({
        order:      i + 1,
        raidAlias:  r.alias  || r.raidAlias  || "",
        raidTag:    r.tag    || r.raidTag    || "",
        raidName:   r.name   || r.raidName   || "",
        difficulty: r.difficulty,
        maxPlayers: r.maxPlayers,
      })),
      // Raid 스키마 필수 필드 (첫 번째 레이드 기준)
      raidName:   firstRaid.name  || firstRaid.raidName  || "",
      raidAlias:  firstRaid.alias || firstRaid.raidAlias || "",
      raidTag:    firstRaid.tag   || firstRaid.raidTag   || "",
      difficulty: firstRaid.difficulty,
      // 공통 필드
      maxPlayers,
      isMobaChul: isMobaChul || false,
      date: isMobaChul ? "" : (date || ""),
      time: isMobaChul ? "" : (time || ""),
      discordChannelId,
      guildId,
      hostId:    hostUserId,
      hostName:  session.user.name,
      hostImage: session.user.image,
      participants,
      status: "모집중",
    })

    // Discord 공고 메시지 전송
    if (discordChannelId) {
      try {
        const msgId = await sendTrainRaidAnnouncement(discordChannelId, trainRaid)
        await Raid.findByIdAndUpdate(trainRaid._id, { discordMessageId: msgId })
      } catch (e) {
        console.error("기차 Discord 공고 전송 실패:", e)
      }
    }

    return Response.json({ success: true, trainRaid })
  } catch (error) {
    console.error(error)
    console.error("기차 레이드 생성 오류:", error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// 기차 레이드 목록 조회 (GET /api/train-raids)
// ※ Raid 컬렉션의 isTrain:true 문서를 반환
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

    await connectDB()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const userId = session.user.discordId || session.user.id

    if (type === "my") {
      const trainRaids = await Raid.find({ hostId: userId, isTrain: true }).sort({ createdAt: -1 }).limit(50)
      return Response.json({ trainRaids })
    }

    const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000)
    const currentDateTime = nowKST.toISOString().slice(0, 16).replace("T", " ")
    const timeFilter = {
      $expr: {
        $or: [
          { $and: [{ $eq: ["$isMobaChul", true] }, { $eq: ["$status", "모집중"] }] },
          { $gte: [{ $concat: ["$date", " ", "$time"] }, currentDateTime] },
        ],
      },
    }

    if (type === "joined") {
      const trainRaids = await Raid.find({
        "participants.userId": userId,
        isTrain: true,
        ...timeFilter,
      }).sort({ createdAt: -1 }).limit(200)
      return Response.json({ trainRaids })
    }

    return Response.json({ trainRaids: [] })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
