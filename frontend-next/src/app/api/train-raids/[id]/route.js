import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    await connectDB()

    const trainRaid = await Raid.findById(id)
    if (!trainRaid) return Response.json({ error: "기차 레이드를 찾을 수 없습니다." }, { status: 404 })

    return Response.json({ trainRaid })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { notifyMinutesBefore } = await request.json()

    await connectDB()

    const trainRaid = await Raid.findById(id)
    if (!trainRaid) return Response.json({ error: "기차 레이드를 찾을 수 없습니다." }, { status: 404 })

    const hostUserId = session.user.discordId || session.user.id
    if (trainRaid.hostId !== hostUserId) {
      return Response.json({ error: "주최자만 변경할 수 있습니다." }, { status: 403 })
    }

    const updated = await Raid.findByIdAndUpdate(id, { notifyMinutesBefore }, { new: true })
    return Response.json({ success: true, raid: updated })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    await connectDB()

    const trainRaid = await Raid.findById(id)
    if (!trainRaid) return Response.json({ error: "기차 레이드를 찾을 수 없습니다." }, { status: 404 })

    const hostUserId = session.user.discordId || session.user.id
    if (trainRaid.hostId !== hostUserId) {
      return Response.json({ error: "주최자만 삭제할 수 있습니다." }, { status: 403 })
    }

    await Raid.findByIdAndDelete(id)
    return Response.json({ success: true })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
