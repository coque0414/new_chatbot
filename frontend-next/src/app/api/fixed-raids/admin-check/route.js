import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

const DISCORD_API = "https://discord.com/api/v10"

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const guildId = searchParams.get("guildId")
    if (!guildId) return Response.json({ error: "guildId 필수" }, { status: 400 })

    const accessToken = session.user.accessToken
    if (!accessToken) return Response.json({ isAdmin: false })

    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return Response.json({ isAdmin: false })

    const guilds = await res.json()
    const guild = guilds.find(g => g.id === guildId)
    if (!guild) return Response.json({ isAdmin: false })

    const perms = BigInt(guild.permissions || "0")
    const isAdmin = (perms & BigInt(0x8)) === BigInt(0x8)

    return Response.json({ isAdmin })
  } catch (e) {
    console.error("[fixed-raids/admin-check]", e.message)
    return Response.json({ isAdmin: false })
  }
}
