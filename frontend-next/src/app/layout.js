import { Cinzel } from "next/font/google"
import "./globals.css"
import Providers from "@/components/providers"

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-cinzel",
})

export const metadata = {
  title: "LostArk Guide",
  description: "로스트아크 공략 챗봇",
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