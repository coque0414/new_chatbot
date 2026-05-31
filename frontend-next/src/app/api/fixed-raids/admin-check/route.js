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
    if (!res.ok) return Response.json({ isAdmin: false })

    const member = await res.json()
    const perms = BigInt(member.permissions || "0")
    const isAdmin = (perms & BigInt(0x8)) === BigInt(0x8)

    return Response.json({ isAdmin })
  } catch (e) {
    console.error("[fixed-raids/admin-check]", e.message)
    return Response.json({ isAdmin: false })
  }
}
