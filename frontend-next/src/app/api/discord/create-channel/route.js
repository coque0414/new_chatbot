import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

const DISCORD_API = "https://discord.com/api/v10"

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { guildId, channelName = "로아-레이드-모집" } = await request.json()

    if (!guildId) {
      return Response.json({ error: "guildId가 필요합니다" }, { status: 400 })
    }

    const accessToken = session.user.accessToken
    if (!accessToken) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const guildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!guildsRes.ok) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
    const guilds = await guildsRes.json()
    const guild = guilds.find(g => g.id === guildId)
    if (!guild || (BigInt(guild.permissions) & BigInt(0x8)) === 0n) {
      return Response.json({ error: "서버 관리자만 채널을 생성할 수 있습니다." }, { status: 403 })
    }

    const token = process.env.DISCORD_BOT_TOKEN

    // 채널 생성
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: channelName,
        type: 0, // 텍스트 채널
        topic: "🗡️ 로스트아크 레이드 모집 전용 채널 | LostArk Guide Bot",
        reason: "LostArk Guide 봇 전용 채널 자동 생성",
      }),
    })

    const channel = await res.json()

    if (!res.ok) {
      return Response.json({ error: channel.message }, { status: res.status })
    }

    return Response.json({
      success: true,
      channel: {
        id: channel.id,
        name: channel.name,
        guildId: guildId,
      }
    })

  } catch (error) {
    console.error(error)
    console.error("채널 생성 오류:", error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}