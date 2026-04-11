import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import GuildSettings from "@/lib/models/GuildSettings"

const DISCORD_API = "https://discord.com/api/v10"

// GET /api/discord/guild-settings/all
// 현재 로그인 유저가 실제로 속한 서버들 중 guildIds와 겹치는 서버 설정만 반환
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.accessToken) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const guildIds = searchParams.get("guildIds")
  if (!guildIds) return Response.json({ settingsMap: {} })

  // 유저가 실제로 속한 서버 목록을 Discord API로 가져옴
  let userGuildIds
  try {
    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    if (!res.ok) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const guilds = await res.json()
    userGuildIds = new Set(guilds.map(g => g.id))
  } catch {
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }

  // 요청된 guildIds 중 유저가 실제로 속한 것만 필터
  const allowedIds = guildIds.split(",").filter(id => userGuildIds.has(id.trim()))
  if (allowedIds.length === 0) return Response.json({ settingsMap: {} })

  await connectDB()
  const settingsList = await GuildSettings.find({ guildId: { $in: allowedIds } }).lean()

  const settingsMap = {}
  for (const s of settingsList) {
    settingsMap[s.guildId] = s
  }

  return Response.json({ settingsMap })
}
