import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"
import { updateDiscordMessage, sendDepartDMs } from "@/lib/discord"

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { role } = await request.json()

    if (!["dealer", "support"].includes(role)) {
      return Response.json({ error: "올바른 역할을 선택하세요" }, { status: 400 })
    }

    await connectDB()
    const raid = await Raid.findById(id)

    if (!raid) {
      return Response.json({ error: "레이드를 찾을 수 없습니다" }, { status: 404 })
    }

    if (raid.status !== "모집중") {
      return Response.json({ error: "모집이 마감된 레이드입니다" }, { status: 400 })
    }

    const userId = session.user.discordId || session.user.id
    const alreadyJoined = raid.participants.some(p => p.userId === userId)
    if (alreadyJoined) {
      return Response.json({ error: "이미 참가 신청한 레이드입니다" }, { status: 400 })
    }

    const supporterSlots = raid.maxPlayers / 4
    const dealerSlots = raid.maxPlayers - supporterSlots
    const dealers = raid.participants.filter(p => p.role === "dealer")
    const supporters = raid.participants.filter(p => p.role === "support")

    if (role === "dealer" && dealers.length >= dealerSlots) {
      return Response.json({ error: "딜러 자리가 꽉 찼습니다" }, { status: 400 })
    }
    if (role === "support" && supporters.length >= supporterSlots) {
      return Response.json({ error: "서포터 자리가 꽉 찼습니다" }, { status: 400 })
    }

    raid.participants.push({
      userId,
      userName: session.user.name,
      userImage: session.user.image,
      role,
    })

    const newDealers = raid.participants.filter(p => p.role === "dealer")
    const newSupporters = raid.participants.filter(p => p.role === "support")
    const isFull = newDealers.length >= dealerSlots && newSupporters.length >= supporterSlots

    if (isFull && raid.isMobaChul) {
      raid.status = "출발완료"
      await raid.save()
      await updateDiscordMessage(raid)
      await sendDepartDMs(raid)
    } else {
      if (isFull) raid.status = "모집완료"
      await raid.save()
      await updateDiscordMessage(raid)
    }

    return Response.json({ success: true, raid })

  } catch (error) {
    console.error(error)
    console.error("참가 신청 오류:", error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}