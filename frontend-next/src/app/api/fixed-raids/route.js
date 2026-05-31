import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import FixedRaid from "@/lib/models/FixedRaid"

const DISCORD_API = "https://discord.com/api/v10"

async function checkAdminPermission(guildId, userId) {
  const token = process.env.DISCORD_BOT_TOKEN
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${token}` },
  })
  if (!res.ok) return false
  const member = await res.json()
  const perms = BigInt(member.permissions || "0")
  return (perms & BigInt(0x8)) === BigInt(0x8)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const guildId = searchParams.get("guildId")
    if (!guildId) return Response.json({ error: "guildId 필수" }, { status: 400 })

    await connectDB()
    const fixedRaids = await FixedRaid.find({ guildId }).sort({ weekday: 1, time: 1 })
    return Response.json({ fixedRaids })
  } catch (e) {
    console.error("[fixed-raids GET]", e.message)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.discordId || session.user.id

    const body = await request.json()
    const { guildId, weekday, time, raidAlias, raidName, raidTag, difficulty, difficulty_level, maxPlayers } = body

    if (!guildId || weekday == null || !time || !raidAlias || !raidName || !raidTag || !difficulty || !maxPlayers) {
      return Response.json({ error: "필수 필드가 누락됐습니다." }, { status: 400 })
    }

    const isAdmin = await checkAdminPermission(guildId, userId)
    if (!isAdmin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })

    const slots = Array.from({ length: maxPlayers }, (_, i) => ({
      slotIndex: i + 1,
      isSupporter: (i === 3 || i === 7),
    }))

    await connectDB()
    const fixedRaid = await FixedRaid.create({
      guildId, weekday, time, raidAlias, raidName, raidTag,
      difficulty, difficulty_level: difficulty_level || null,
      maxPlayers, slots,
    })

    return Response.json({ fixedRaid }, { status: 201 })
  } catch (e) {
    console.error("[fixed-raids POST]", e.message)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
