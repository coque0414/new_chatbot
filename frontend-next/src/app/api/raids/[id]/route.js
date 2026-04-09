import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"

const DISCORD_API = "https://discord.com/api/v10"

export async function GET(request, { params }) {
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

    return Response.json({ raid })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { notifyMinutesBefore } = await request.json()

    if (![10, 20, 30].includes(notifyMinutesBefore)) {
      return Response.json({ error: "유효하지 않은 알림 시간입니다 (10/20/30만 허용)" }, { status: 400 })
    }

    await connectDB()
    const raid = await Raid.findById(id)
    if (!raid) return Response.json({ error: "레이드를 찾을 수 없습니다" }, { status: 404 })

    const userId = session.user.discordId || session.user.id
    if (raid.hostId !== userId) {
      return Response.json({ error: "주최자만 변경할 수 있습니다" }, { status: 403 })
    }

    const updated = await Raid.findByIdAndUpdate(id, { notifyMinutesBefore }, { new: true })
    return Response.json({ success: true, raid: updated })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
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

    // 주최자만 취소 가능
    const userId = session.user.discordId || session.user.id
    if (raid.hostId !== userId) {
      return Response.json({ error: "주최자만 취소할 수 있습니다" }, { status: 403 })
    }

    // Discord 메시지 삭제
    // 왜냐면: 레이드가 취소됐는데 Discord에 모집 공지가 남아있으면 안 되니까
    if (raid.discordChannelId && raid.discordMessageId) {
      try {
        await fetch(`${DISCORD_API}/channels/${raid.discordChannelId}/messages/${raid.discordMessageId}`, {
          method: "DELETE",
          headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        })
      } catch (e) {
        console.error("Discord 메시지 삭제 실패:", e)
      }
    }

    // MongoDB 상태 변경
    raid.status = "취소"
    await raid.save()

    return Response.json({ success: true })

  } catch (error) {
    console.error("레이드 취소 오류:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}