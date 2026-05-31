import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import UserCharacters from "@/lib/models/UserCharacters"
import { SUPPORTER_CLASSES } from "@/lib/lostarkData"

const DISCORD_API = "https://discord.com/api/v10"
const BATCH_SIZE = 10

async function fetchMember(guildId, discordId, token) {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordId}`, {
    headers: { Authorization: `Bot ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const guildId = searchParams.get("guildId")
    if (!guildId) return Response.json({ error: "guildId 필수" }, { status: 400 })

    await connectDB()
    const allUserChars = await UserCharacters.find({})
    const token = process.env.DISCORD_BOT_TOKEN

    const members = []

    // 최대 10명씩 배치로 Discord API 병렬 호출
    for (let i = 0; i < allUserChars.length; i += BATCH_SIZE) {
      const batch = allUserChars.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(async (userChar) => {
          const member = await fetchMember(guildId, userChar.discordId, token)
          if (!member) return null

          const serverNick = member.nick ?? member.user?.username ?? userChar.discordId

          // accounts 구조 또는 레거시 characters 구조 통합
          let allChars = []
          if (userChar.accounts?.length > 0) {
            userChar.accounts.forEach(acc => (acc.characters || []).forEach(c => allChars.push(c)))
          } else {
            allChars = userChar.characters || []
          }

          const characters = allChars.map(c => ({
            name: c.name,
            class: c.class,
            level: c.level,
            combatPower: c.combatPower ?? null,
            role: SUPPORTER_CLASSES.includes(c.class) ? "support" : "dealer",
          }))

          return { discordId: userChar.discordId, serverNick, characters }
        })
      )
      results.filter(Boolean).forEach(m => members.push(m))
    }

    return Response.json({ members })
  } catch (e) {
    console.error("[fixed-raids/members GET]", e.message)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
