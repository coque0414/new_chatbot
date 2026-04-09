"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { getTheme } from "@/lib/themes"

export default function ChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [themeId, setThemeId] = useState("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("themeId")
    if (saved) setThemeId(saved)
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem("themeId", themeId)
  }, [themeId, mounted])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: getTheme(themeId).bg }}>
        <div className="text-sm animate-pulse" style={{ color: getTheme(themeId).subtext }}>로딩 중...</div>
      </div>
    )
  }

  if (!session) return null

  const theme = getTheme(themeId)
  const d = theme.isDark

  return (
    <DashboardLayout themeId={themeId} setThemeId={setThemeId} session={session} activeNav="chat">
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🤖</div>

          <h1 className={`text-2xl font-bold mb-3 ${d ? "text-white" : "text-gray-800"}`}
            style={{ fontFamily: "var(--font-cinzel), serif" }}>
            공략 챗봇
          </h1>

          <p className={`text-base font-medium mb-4 ${d ? "text-amber-400" : "text-purple-600"}`}>
            현재 개발 중인 기능입니다. 조금만 기다려주세요!
          </p>

          <p className={`text-sm leading-relaxed mb-8 ${d ? "text-gray-400" : "text-gray-500"}`}>
            로스트아크 레이드 공략, 캐릭터 정보 등을<br />
            AI로 검색할 수 있는 기능을 준비 중입니다.
          </p>

          <a href="/dashboard">
            <Button className={`gap-2 ${d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"}`}>
              <ChevronLeft size={16} />
              대시보드로 돌아가기
            </Button>
          </a>
        </div>
      </div>
    </DashboardLayout>
  )
}
