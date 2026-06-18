import { connectDB } from "@/lib/mongodb"
import BotStats from "@/lib/models/BotStats"

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get("secret")
    const days = Math.min(parseInt(searchParams.get("days") || "30", 10), 90)

    if (secret !== process.env.ADMIN_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()
    const stats = await BotStats.find().sort({ date: -1 }).limit(days).lean()

    const summary = {
      totalCommands: stats.reduce((acc, s) => {
        const u = s.commandUsage || {}
        return acc + (u["모집"] || 0) + (u["모바출모집"] || 0) + (u["참가"] || 0) + (u["같이참가"] || 0) + (u["지난레이드삭제"] || 0)
      }, 0),
      totalButtonClicks: stats.reduce((acc, s) => {
        const b = s.buttonClicks || {}
        return acc + (b.join_dealer || 0) + (b.join_support || 0) + (b.cancel || 0) + (b.launch || 0) + (b.cancel_raid || 0) + (b.participants || 0)
      }, 0),
      totalRaidsCreated: stats.reduce((acc, s) => {
        const r = s.raidsCreated || {}
        return acc + (r.web || 0) + (r.discord || 0)
      }, 0),
      totalRaidsJoined: stats.reduce((acc, s) => {
        const r = s.raidsJoined || {}
        return acc + (r.web || 0) + (r.discord || 0)
      }, 0),
    }

    return Response.json({ stats, summary })
  } catch (error) {
    console.error("stats 조회 오류:", error)
    return Response.json({ error: "서버 오류" }, { status: 500 })
  }
}
