import { connectDB } from "@/lib/mongodb"
import BotStats from "@/lib/models/BotStats"

function getTodayStr() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export async function incrementStat(path, amount = 1) {
  try {
    await connectDB()
    const today = getTodayStr()
    await BotStats.findOneAndUpdate(
      { date: today },
      { $inc: { [path]: amount } },
      { upsert: true, new: true }
    )
  } catch (e) {
    console.error("[Stats] 업데이트 실패:", e.message)
  }
}
