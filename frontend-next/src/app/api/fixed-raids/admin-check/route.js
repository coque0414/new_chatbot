import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

const DISCORD_API = "https://discord.com/api/v10"

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.discordId || session.user.id

    const { searchParams } = new URL(request.url)
    const guildId = searchParams.get("guildId")
    if (!guildId) return Response.json({ error: "guildId 필수" }, { status: 400 })

    const token = process.env.DISCORD_BOT_TOKEN
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${token}` },
    })
    console.log("[admin-check] Discord API status:", res.status)
    if (!res.ok) return Response.json({
      isAdmin: false,
      debug: {
        discordApiStatus: res.status,
        error: "Discord API 호출 실패",
      },
    })

    const member = await res.json()
    console.log("[admin-check] member.nick:", member.nick)
    console.log("[admin-check] member.permissions:", member.permissions)
    console.log("[admin-check] permissions type:", typeof member.permissions)

    const perms = BigInt(member.permissions || "0")
    console.log("[admin-check] perms BigInt:", perms)
    console.log("[admin-check] ADMINISTRATOR check:", (perms & BigInt(0x8)) === BigInt(0x8))

    return Response.json({
      isAdmin: (perms & BigInt(0x8)) === BigInt(0x8),
      debug: {
        discordApiStatus: res.status,
        hasPermissions: !!member.permissions,
        permissionsRaw: member.permissions,
        permissionsType: typeof member.permissions,
        userId,
        guildId,
      },
    })
  } catch (e) {
    console.error("[fixed-raids/admin-check]", e.message)
    return Response.json({ isAdmin: false })
  }
}
