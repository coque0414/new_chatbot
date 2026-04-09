import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"
import { updateDiscordMessage } from "@/lib/discord"

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    await connectDB()
    const raid = await Raid.findById(id)

    if (!raid) {
      return Response.json({ error: "레이드를 찾을 수 없습니다" }, { status: 404 })
    }

    const userId = session.user.discordId || session.user.id
    const participantIndex = raid.participants.findIndex(p => p.userId === userId)

    if (participantIndex === -1) {
      return Response.json({ error: "참가 신청하지 않은 레이드입니다" }, { status: 400 })
    }

    raid.participants.splice(participantIndex, 1)
    if (raid.status === "모집완료") raid.status = "모집중"
    await raid.save()
    await updateDiscordMessage(raid)

    return Response.json({ success: true, raid })

  } catch (error) {
    console.error("참가 취소 오류:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}