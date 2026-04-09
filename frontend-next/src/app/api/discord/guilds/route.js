import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

const DISCORD_API = "https://discord.com/api/v10"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userToken = session.accessToken
    const botToken = process.env.DISCORD_BOT_TOKEN

    if (!userToken) {
      return Response.json({ error: "accessToken 없음. 재로그인 필요" }, { status: 401 })
    }

    // 사용자가 속한 서버 목록
    const userGuildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (!userGuildsRes.ok) {
      return Response.json({ error: "사용자 서버 목록 조회 실패" }, { status: 500 })
    }
    const userGuilds = await userGuildsRes.json()

    // 봇이 속한 서버 목록
    const botGuildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${botToken}` },
    })
    if (!botGuildsRes.ok) {
      return Response.json({ error: "봇 서버 목록 조회 실패" }, { status: 500 })
    }
    const botGuilds = await botGuildsRes.json()
    const botGuildIds = new Set(botGuilds.map(g => g.id))

    // 교차: 봇이 설치된 서버만 반환
    const guilds = userGuilds
      .filter(g => botGuildIds.has(g.id))
      .map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
          : null,
      }))

    return Response.json({ guilds })

  } catch (error) {
    console.error("guilds API 오류:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
