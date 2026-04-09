import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import GuildSettings from "@/lib/models/GuildSettings"

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
  } = body

  if (!guildId) return Response.json({ error: "guildId 필요" }, { status: 400 })

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
    },
    { upsert: true, new: true }
  )
  return Response.json({ success: true, settings })
}

// 하위 호환: 기존 PATCH도 유지
export async function PATCH(request) {
  return POST(request)
}
