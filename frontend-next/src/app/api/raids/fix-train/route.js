import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"

// 기차 레이드 데이터 진단 API
// GET /api/raids/fix-train
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    // trainId 필드가 존재하고 null/빈 문자열이 아닌 레이드 조회
    const results = await Raid.find({
      trainId: { $exists: true, $ne: null, $ne: "" },
    }).sort({ createdAt: -1 }).limit(100)

    const summary = results.map(r => ({
      _id: r._id,
      trainId: r.trainId,
      trainIdType: typeof r.trainId,
      trainIdLength: r.trainId?.length ?? null,
      trainOrder: r.trainOrder,
      trainTotal: r.trainTotal,
      raidAlias: r.raidAlias,
      hostId: r.hostId,
      createdAt: r.createdAt,
    }))

    console.log("[fix-train] trainId 있는 레이드:", JSON.stringify(summary, null, 2))

    // 전체 레이드 수 (trainId 포함 여부와 무관)
    const totalCount = await Raid.countDocuments()
    const trainCount = results.length

    // trainId가 null인 레이드 수
    const nullTrainCount = await Raid.countDocuments({ trainId: null })
    const emptyTrainCount = await Raid.countDocuments({ trainId: "" })
    const missingTrainCount = await Raid.countDocuments({ trainId: { $exists: false } })

    return Response.json({
      totalRaids: totalCount,
      trainIdExists: trainCount,
      trainIdNull: nullTrainCount,
      trainIdEmpty: emptyTrainCount,
      trainIdMissing: missingTrainCount,
      raids: summary,
    })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
