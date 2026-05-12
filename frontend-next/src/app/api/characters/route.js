import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import UserCharacters from "@/lib/models/UserCharacters"

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const discordId = session.user.discordId || session.user.id

  await connectDB()
  const doc = await UserCharacters.findOne({ discordId })
  return Response.json({
    characters: doc?.characters || [],
    representCharacter: doc?.representCharacter || null,
    accounts: doc?.accounts || [],
  })
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const discordId = session.user.discordId || session.user.id

  const { searchParams } = new URL(request.url)
  const accountIndex = parseInt(searchParams.get("accountIndex"))

  if (!accountIndex || accountIndex === 1) {
    return Response.json({ error: "계정 1은 삭제할 수 없습니다." }, { status: 400 })
  }
  if (accountIndex < 2 || accountIndex > 4) {
    return Response.json({ error: "유효하지 않은 계정 번호입니다." }, { status: 400 })
  }

  await connectDB()
  await UserCharacters.findOneAndUpdate(
    { discordId },
    { $pull: { accounts: { accountIndex } } }
  )
  return Response.json({ ok: true })
}
