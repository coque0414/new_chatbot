import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import UserCharacters from "@/lib/models/UserCharacters"

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const discordId = searchParams.get("discordId")

  let resolvedId = discordId
  if (!resolvedId) {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
    resolvedId = session.user.discordId || session.user.id
  }

  await connectDB()
  const doc = await UserCharacters.findOne({ discordId: resolvedId })
  return Response.json({
    characters: doc?.characters || [],
    representCharacter: doc?.representCharacter || null,
  })
}
