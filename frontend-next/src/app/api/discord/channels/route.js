import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

const DISCORD_API = "https://discord.com/api/v10"

// 봇이 참여한 서버 목록 + 텍스트 채널 가져오기
// GET /api/discord/channels          → 전체 서버 채널 목록
// GET /api/discord/channels?guildId= → 특정 서버 채널만 반환
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const guildId = searchParams.get("guildId")
    const token = process.env.DISCORD_BOT_TOKEN

    // 특정 서버 채널만 반환
    if (guildId) {
      const channelsRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
        headers: { Authorization: `Bot ${token}` },
      })
      if (!channelsRes.ok) {
        return Response.json({ error: "채널 목록 조회 실패" }, { status: 500 })
      }
      const channels = await channelsRes.json()
      const textChannels = channels
        .filter(ch => ch.type === 0)
        .sort((a, b) => a.position - b.position)
        .map(ch => ({ id: ch.id, name: ch.name, guildId }))
      return Response.json({ channels: textChannels })
    }

    // 전체 서버 채널 목록 (기존 동작 유지)
    const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${token}` }
    })
    const guilds = await guildsRes.json()

    const guildsWithChannels = await Promise.all(
      guilds.map(async (guild) => {
        const channelsRes = await fetch(`${DISCORD_API}/guilds/${guild.id}/channels`, {
          headers: { Authorization: `Bot ${token}` }
        })
        const channels = await channelsRes.json()
        const textChannels = channels
          .filter(ch => ch.type === 0)
          .sort((a, b) => a.position - b.position)
          .map(ch => ({
            id: ch.id,
            name: ch.name,
            guildId: guild.id,
            guildName: guild.name,
          }))
        return {
          id: guild.id,
          name: guild.name,
          icon: guild.icon
            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
            : null,
          channels: textChannels,
        }
      })
    )

    return Response.json({ guilds: guildsWithChannels })

  } catch (error) {
    console.error("Discord API error:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
