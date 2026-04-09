import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import GuildSettings from "@/lib/models/GuildSettings"

// GET /api/discord/guild-settings/all
// 현재 로그인 유저가 접근 가능한 서버들의 설정 전체 반환
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const guildIds = searchParams.get("guildIds") // 쉼표 구분 guildId 목록

  await connectDB()

  const query = guildIds
    ? { guildId: { $in: guildIds.split(",") } }
    : {}

  const settingsList = await GuildSettings.find(query).lean()

  // guildId → settings 맵으로 반환
  const settingsMap = {}
  for (const s of settingsList) {
    settingsMap[s.guildId] = s
  }

  return Response.json({ settingsMap })
}
