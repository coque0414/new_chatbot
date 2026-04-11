import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { trainId } = await params
    await connectDB()

    const docs = await Raid.find({ trainId }).sort({ trainOrder: 1 })
    if (!docs.length) {
      return Response.json({ error: "기차 레이드를 찾을 수 없습니다" }, { status: 404 })
    }

    const first = docs.find(r => r.trainOrder === 1) || docs[0]

    const train = {
      trainId,
      trainLabel: first.trainLabel,
      trainTotal: first.trainTotal,
      maxPlayers: first.maxPlayers,
      status: first.status,
      isMobaChul: first.isMobaChul,
      date: first.date,
      time: first.time,
      hostName: first.hostName,
      hostId: first.hostId,
      hostImage: first.hostImage,
      participants: first.participants,
      discordMessageId: first.discordMessageId,
      discordChannelId: first.discordChannelId,
      guildId: first.guildId,
      createdAt: first.createdAt,
      raids: docs.map(r => ({
        _id: r._id,
        trainOrder: r.trainOrder,
        raidName: r.raidName,
        raidAlias: r.raidAlias,
        raidTag: r.raidTag,
        difficulty: r.difficulty,
      })),
    }

    return Response.json({ train })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
