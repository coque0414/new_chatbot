"use client"

import { signIn } from "next-auth/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sun, Moon } from "lucide-react"

export default function LoginPage() {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("theme")
    if (saved === "dark") setDark(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark, mounted])

  if (!mounted) return null

  const d = dark

  return (
    <div className={`min-h-screen flex items-center justify-center transition-colors duration-300
      ${d ? "bg-[#0f1117]" : "bg-[#f5f0ff]"}`}>

      {/* 배경 블러 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {d ? (
          <>
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
          </>
        ) : (
          <>
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-300/25 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-300/25 rounded-full blur-3xl" />
          </>
        )}
      </div>

      {/* 다크모드 토글 */}
      <button
        onClick={() => setDark(!dark)}
        className={`fixed top-5 right-6 p-2 rounded-full transition-colors z-10
          ${d ? "bg-white/10 hover:bg-white/20" : "bg-purple-100 hover:bg-purple-200"}`}
        aria-label="테마 변경"
      >
        {d
          ? <Sun size={16} className="text-amber-400" />
          : <Moon size={16} className="text-purple-600" />
        }
      </button>

      {/* 로그인 카드 */}
      <div className={`relative z-10 w-full max-w-md mx-4 border rounded-3xl p-10 text-center
        ${d
          ? "bg-white/[0.03] border-white/10"
          : "bg-white border-purple-100 shadow-xl shadow-purple-100/50"
        }`}>

        {/* 로고 */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="text-3xl">⚔️</span>
          <span
            className={`text-xl font-bold tracking-widest uppercase
              ${d ? "text-amber-400" : "text-purple-700"}`}
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            LostArk Guide
          </span>
        </div>

        <h1
          className={`text-2xl font-bold mb-2 ${d ? "text-white" : "text-gray-800"}`}
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          시작하기
        </h1>
        <p className={`text-sm mb-8 ${d ? "text-gray-400" : "text-gray-500"}`}>
          Discord 계정으로 로그인하면<br />
          모든 기능을 이용할 수 있습니다.
        </p>

        {/* Discord 로그인 버튼 */}
        <Button
          size="lg"
          className="w-full py-6 text-base font-bold tracking-wide bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl gap-3"
          onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.043.03.056a19.909 19.909 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Discord로 로그인
        </Button>

        <p className={`text-xs mt-6 ${d ? "text-gray-600" : "text-gray-400"}`}>
          로그인 시{" "}
          <span className={d ? "text-amber-400" : "text-purple-600"}>서비스 이용약관</span>
          에 동의하게 됩니다.
        </p>

        {/* 홈으로 */}
        <a
          href="/"
          className={`block mt-4 text-xs transition-colors
            ${d ? "text-gray-600 hover:text-gray-400" : "text-gray-400 hover:text-gray-600"}`}
        >
          ← 홈으로 돌아가기
        </a>
      </div>
    </div>
  )
}
