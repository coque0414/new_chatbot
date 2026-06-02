import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import GuildSettings from "@/lib/models/GuildSettings"

async function isGuildAdmin(guildId, accessToken) {
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return false
    const guilds = await res.json()
    const guild = guilds.find(g => g.id === guildId)
    if (!guild) return false
    return (BigInt(guild.permissions) & BigInt(0x8)) !== 0n
  } catch {
    return false
  }
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const guildId = searchParams.get("guildId")
  if (!guildId) return Response.json({ error: "guildId 필요" }, { status: 400 })

  await connectDB()
  const settings = await GuildSettings.findOne({ guildId })
  return Response.json({
    settings: settings || {
      guildId,
      announcementChannelId: null,
      announcementChannelName: null,
      createChannelId: null,
      createChannelName: null,
      voiceChannelEnabled: true,
      fixedRaidDmEnabled: true,
      fixedRaidNotifyEnabled: true,
    }
  })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const {
    guildId, guildName, guildIcon,
    announcementChannelId, announcementChannelName,
    createChannelId, createChannelName,
    voiceChannelEnabled,
    fixedRaidDmEnabled,
    fixedRaidNotifyEnabled,
  } = body

  if (!guildId) return Response.json({ error: "guildId 필요" }, { status: 400 })

  if (!session.user.accessToken) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const admin = await isGuildAdmin(guildId, session.user.accessToken)
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const settings = await GuildSettings.findOneAndUpdate(
    { guildId },
    {
      ...(guildName !== undefined && { guildName }),
      ...(guildIcon !== undefined && { guildIcon }),
      ...(announcementChannelId !== undefined && { announcementChannelId }),
      ...(announcementChannelName !== undefined && { announcementChannelName }),
      ...(createChannelId !== undefined && { createChannelId }),
      ...(createChannelName !== undefined && { createChannelName }),
      ...(voiceChannelEnabled !== undefined && { voiceChannelEnabled }),
      ...(fixedRaidDmEnabled !== undefined && { fixedRaidDmEnabled }),
      ...(fixedRaidNotifyEnabled !== undefined && { fixedRaidNotifyEnabled }),
    },
    { upsert: true, new: true }
  )
  return Response.json({ success: true, settings })
}

// 하위 호환: 기존 PATCH도 유지
export async function PATCH(request) {
  return POST(request)
}
