import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import UserCharacters from "@/lib/models/UserCharacters"
import { SUPPORTER_CLASSES } from "@/lib/lostarkData"

const DISCORD_API = "https://discord.com/api/v10"

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const guildId = searchParams.get("guildId")
    if (!guildId) return Response.json({ error: "guildId 필수" }, { status: 400 })

    const token = process.env.DISCORD_BOT_TOKEN

    const guildMembersRes = await fetch(
      `${DISCORD_API}/guilds/${guildId}/members?limit=1000`,
      { headers: { Authorization: `Bot ${token}` } }
    )
    if (!guildMembersRes.ok) {
      return Response.json({ error: "서버 멤버 조회 실패" }, { status: 500 })
    }
    const guildMembers = await guildMembersRes.json()

    const memberMap = new Map(
      guildMembers.map(m => [m.user.id, m])
    )

    await connectDB()
    const allUserChars = await UserCharacters.find({})

    const members = []
    for (const userChar of allUserChars) {
      const member = memberMap.get(userChar.discordId)
      if (!member) continue

      const serverNick = member.nick ?? member.user?.username ?? userChar.discordId

      let allChars = []
      if (userChar.accounts?.length > 0) {
        userChar.toObject().accounts.forEach(acc =>
          (acc.characters || []).forEach(c => allChars.push(c))
        )
      } else {
        allChars = (userChar.toObject().characters || [])
      }

      const characters = allChars.map(c => ({
        name: c.name,
        class: c.class,
        level: c.level,
        combatPower: c.combatPower ?? null,
        role: SUPPORTER_CLASSES.includes(c.class) ? "support" : "dealer",
      }))

      if (characters.length === 0) continue

      members.push({ discordId: userChar.discordId, serverNick, characters })
    }

    return Response.json({ members })
  } catch (e) {
    console.error("[fixed-raids/members GET]", e.message)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
