export async function GET() {
  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) {
    return Response.json({ error: "DISCORD_CLIENT_ID not configured" }, { status: 500 })
  }

  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=537217024&scope=bot%20applications.commands`
  return Response.json({ inviteUrl })
}
