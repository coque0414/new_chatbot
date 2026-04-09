import NextAuth from "next-auth"
import DiscordProvider from "next-auth/providers/discord"

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      // guilds scope 필요: /api/discord/guilds에서 사용자 서버 목록 조회에 사용
      // ⚠️ scope 변경 후 기존 세션은 재로그인 필요
      authorization: { params: { scope: "identify email guilds" } },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub
      session.user.discordId = token.discordId
      session.user.image = token.picture
      session.accessToken = token.accessToken
      return session
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token
      }
      if (profile) {
        token.discordId = profile.id
      }
      return token
    },
  },
  pages: {
    signIn: "/login",
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }