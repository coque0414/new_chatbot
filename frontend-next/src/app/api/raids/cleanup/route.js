import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"

const DISCORD_API = "https://discord.com/api/v10"

function buildStaleQuery(userId) {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const currentDateTime = nowKST.toISOString().slice(0, 16).replace("T", " ")
  return {
    hostId: userId,
    $or: [
      { status: "취소" },
      { status: "출발완료" },
      {
        isMobaChul: false,
        $expr: { $lt: [{ $concat: ["$date", " ", "$time"] }, currentDateTime] },
      },
    ],
  }
}

// GET /api/raids/cleanup?preview=true
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    if (searchParams.get("preview") !== "true") {
      return Response.json({ error: "preview=true 파라미터가 필요합니다." }, { status: 400 })
    }

    await connectDB()
    const userId = session.user.discordId || session.user.id
    const staleQuery = buildStaleQuery(userId)

    const raidDocs = await Raid.find(staleQuery)
      .select("_id raidAlias trainLabel difficulty date time status isMobaChul isTrain discordMessageId discordChannelId")
      .sort({ createdAt: -1 })

    const raids = raidDocs.map(r => ({ ...r.toObject(), isTrainRaid: r.isTrain || false }))

    return Response.json({ raids })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// DELETE /api/raids/cleanup
// body: { mode: "web" | "discord" | "both", raidIds: [...] }
// raidIds: [{ id, isTrainRaid }] — isTrainRaid 필드는 무시, 모두 Raid 컬렉션에서 처리
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { mode, raidIds } = await request.json()
    if (!mode || !raidIds?.length) {
      return Response.json({ error: "mode와 raidIds가 필요합니다." }, { status: 400 })
    }

    await connectDB()
    const userId = session.user.discordId || session.user.id
    const ids = raidIds.map(r => r.id || r)

    // 본인 레이드만 처리 (보안)
    const raidDocs = await Raid.find({ _id: { $in: ids }, hostId: userId })
      .select("_id discordChannelId discordMessageId")

    const errors = []
    let discordDeleted = 0
    let webDeleted = 0

    // Discord 메시지 삭제
    if (mode === "discord" || mode === "both") {
      const token = process.env.DISCORD_BOT_TOKEN
      for (const raid of raidDocs) {
        if (!raid.discordChannelId || !raid.discordMessageId) continue
        try {
          const res = await fetch(
            `${DISCORD_API}/channels/${raid.discordChannelId}/messages/${raid.discordMessageId}`,
            { method: "DELETE", headers: { Authorization: `Bot ${token}` } }
          )
          if (res.ok || res.status === 404) discordDeleted++
          else errors.push(`Discord 삭제 실패 (${raid._id}): HTTP ${res.status}`)
        } catch (e) {
          console.error(`Discord 삭제 실패 (${raid._id}):`, e)
          errors.push(`Discord 삭제 실패 (${raid._id})`)
        }
      }
    }

    // MongoDB 삭제
    if (mode === "web" || mode === "both") {
      const result = await Raid.deleteMany({ _id: { $in: raidDocs.map(r => r._id) } })
      webDeleted = result.deletedCount
    }

    return Response.json({ success: true, webDeleted, discordDeleted, errors })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
