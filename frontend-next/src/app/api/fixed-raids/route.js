import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import FixedRaid from "@/lib/models/FixedRaid"

async function checkAdminPermission(session, guildId) {
  const accessToken = session?.accessToken
  if (!accessToken) return false
  try {
    const res = await fetch(
      "https://discord.com/api/v10/users/@me/guilds",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return false
    const guilds = await res.json()
    const guild = guilds.find(g => g.id === guildId)
    if (!guild) return false
    const perms = BigInt(guild.permissions || "0")
    return (perms & BigInt(0x8)) === BigInt(0x8)
  } catch {
    return false
  }
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

    const body = await request.json()
    const { guildId, weekday, time, raidAlias, raidName, raidTag, difficulty, difficulty_level, maxPlayers } = body

    if (!guildId || weekday == null || !time || !raidAlias || !raidName || !raidTag || !difficulty || !maxPlayers) {
      return Response.json({ error: "필수 필드가 누락됐습니다." }, { status: 400 })
    }

    const isAdmin = await checkAdminPermission(session, guildId)
    if (!isAdmin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })

    const existingCount = await FixedRaid.countDocuments({ guildId })
    if (existingCount >= 15) {
      return Response.json(
        { error: "서버당 고정 레이드는 최대 15개까지 등록 가능합니다." },
        { status: 400 }
      )
    }

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
