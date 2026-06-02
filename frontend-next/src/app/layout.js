import { Cinzel } from "next/font/google"
import "./globals.css"
import Providers from "@/components/providers"

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-cinzel",
})

export const metadata = {
  title: "미니미 | 로스트아크 레이드 모집 봇",
  description: "로스트아크 레이드 모집을 Discord 봇과 웹 대시보드로 편리하게 관리하세요. 레이드 예약, 참가자 관리, 캐릭터 연동을 한 곳에서.",
  keywords: "로스트아크, 레이드 모집, 디스코드 봇, 레이드 예약, 로아 봇",
  openGraph: {
    title: "미니미 | 로스트아크 레이드 모집 봇",
    description: "로스트아크 레이드 모집을 Discord 봇과 웹 대시보드로 편리하게 관리하세요.",
    url: "https://loaraid-discobot.vercel.app",
    siteName: "미니미",
    locale: "ko_KR",
    type: "website",
  },
  verification: {
    google: "WaTotYDN-MM9lnbn6j4oO6nbASMrUhGaSId-Pf950OU",
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className={cinzel.variable}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}