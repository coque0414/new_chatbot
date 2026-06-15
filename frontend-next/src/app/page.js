"use client"

import { signIn } from "next-auth/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sun, Moon } from "lucide-react"

const FEATURES = [
  {
    icon: "📋",
    title: "레이드 모집 공고",
    desc: "원하는 레이드와 날짜를 설정하면 Discord 채널에 모집 공고가 자동으로 올라가요.",
  },
  {
    icon: "🎮",
    title: "Discord 버튼 참가",
    desc: "공고 메시지의 버튼을 눌러 딜러/서포터로 바로 참가할 수 있어요. 캐릭터 정보도 자동으로 등록돼요.",
  },
  {
    icon: "⏰",
    title: "레이드 시작 전 DM 알림",
    desc: "레이드 시작 10/20/30분 전에 참가자 전원에게 DM으로 알림을 보내드려요.",
  },
  {
    icon: "🚂",
    title: "N종 레이드 지원",
    desc: "여러 레이드를 연달아 도는 N종 레이드도 한 번에 모집할 수 있어요.",
  },
]

const RAIDS = [
  { name: "에기르 레이드", level: "1660+", tag: "1막", lightColor: "text-orange-400", darkColor: "text-orange-300" },
  { name: "아브렐슈드 레이드", level: "1670+", tag: "2막", lightColor: "text-purple-500", darkColor: "text-purple-300" },
  { name: "모르둠 레이드", level: "1680+", tag: "3막", lightColor: "text-blue-500", darkColor: "text-blue-300" },
  { name: "파멸의 성채", level: "1700+", tag: "4막", lightColor: "text-rose-500", darkColor: "text-rose-300" },
  { name: "최후의 날", level: "1710+", tag: "종막", lightColor: "text-amber-500", darkColor: "text-amber-300" },
  { name: "그림자 레이드", level: "1710+", tag: "세르카", lightColor: "text-emerald-500", darkColor: "text-emerald-300" },
]

async function openBotInvite() {
  try {
    const res = await fetch("/api/discord/bot-invite")
    const data = await res.json()
    if (data.inviteUrl) window.open(data.inviteUrl, "_blank")
  } catch {
    // ignore
  }
}

export default function LandingPage() {
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
    <div className={`min-h-screen transition-colors duration-300 overflow-x-hidden
      ${d ? "bg-[#0f1117] text-white" : "bg-[#f5f0ff] text-gray-800"}`}>

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
            <div className="absolute top-1/2 right-0 w-64 h-64 bg-pink-200/25 rounded-full blur-3xl" />
          </>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className={`relative z-10 sticky top-0 flex items-center justify-between px-8 py-5 border-b backdrop-blur-md
        ${d ? "bg-[#0f1117]/80 border-white/10" : "bg-white/80 border-purple-100"}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚔️</span>
          <span className={`text-xl font-bold tracking-widest uppercase ${d ? "text-amber-400" : "text-purple-700"}`}
            style={{ fontFamily: "var(--font-cinzel), serif" }}>
            LostArk 레이드
          </span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features"
            className={`text-sm transition-colors tracking-wide ${d ? "text-gray-400 hover:text-amber-400" : "text-gray-500 hover:text-purple-600"}`}>
            기능
          </a>
          <a href="#raids"
            className={`text-sm transition-colors tracking-wide ${d ? "text-gray-400 hover:text-amber-400" : "text-gray-500 hover:text-purple-600"}`}>
            레이드
          </a>
          <a href="/guide"
            className={`text-sm transition-colors tracking-wide ${d ? "text-gray-400 hover:text-amber-400" : "text-gray-500 hover:text-purple-600"}`}>
            사용 가이드
          </a>

          {/* 다크모드 토글 */}
          <button
            onClick={() => setDark(!dark)}
            className={`p-2 rounded-full transition-colors ${d ? "bg-white/10 hover:bg-white/20" : "bg-purple-100 hover:bg-purple-200"}`}
            aria-label="테마 변경"
          >
            {d
              ? <Sun size={16} className="text-amber-400" />
              : <Moon size={16} className="text-purple-600" />
            }
          </button>

          <Button
            className={`font-bold px-5 py-2 text-sm tracking-wide
              ${d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"}`}
            onClick={() => window.location.href = "/login"}>
            Discord 로그인
          </Button>
        </div>
      </nav>

      {/* 히어로 */}
      <section className="relative z-10 flex flex-col items-center text-center px-4 pt-28 pb-24">
        <Badge className={`mb-6 px-4 py-1 text-xs tracking-widest uppercase
          ${d ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-purple-100 text-purple-600 border-purple-200"}`}>
          Discord 연동 레이드 모집 시스템
        </Badge>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
          style={{ fontFamily: "var(--font-cinzel), serif" }}>
          로스트아크
          <br />
          <span className={`bg-gradient-to-r bg-clip-text text-transparent
            ${d ? "from-amber-400 via-orange-400 to-yellow-300" : "from-purple-500 via-violet-500 to-indigo-500"}`}>
            레이드 모집
          </span>
        </h1>

        <p className={`text-lg md:text-xl max-w-2xl mb-10 leading-relaxed ${d ? "text-gray-400" : "text-gray-500"}`}>
          Discord 서버와 연동된 레이드 모집 시스템으로<br />
          파티를 쉽고 빠르게 구성하세요.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button size="lg"
            className={`font-bold px-8 py-4 text-base tracking-wide
              ${d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"}`}
            onClick={() => window.location.href = "/login"}>
            Discord로 시작하기
          </Button>
          <Button size="lg" variant="outline"
            className={`font-bold px-8 py-4 text-base tracking-wide
              ${d ? "border-amber-500/40 text-amber-400 hover:bg-amber-500/10" : "border-purple-300 text-purple-600 hover:bg-purple-50"}`}
            onClick={openBotInvite}>
            봇 추가하기
          </Button>
        </div>

        <div className={`flex gap-12 mt-16 pt-10 border-t ${d ? "border-white/5" : "border-purple-100"}`}>
          {[
            { value: "8+", label: "지원 레이드" },
            { value: "DM", label: "자동 알림" },
            { value: "Discord", label: "자동 연동" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className={`text-2xl font-bold ${d ? "text-amber-400" : "text-purple-600"}`}
                style={{ fontFamily: "var(--font-cinzel), serif" }}>
                {stat.value}
              </div>
              <div className={`text-xs mt-1 tracking-wider uppercase ${d ? "text-gray-500" : "text-gray-400"}`}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 기능 섹션 */}
      <section id="features" className="relative z-10 px-8 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "var(--font-cinzel), serif" }}>
              주요 기능
            </h2>
            <p className={`text-sm tracking-widest uppercase ${d ? "text-gray-500" : "text-gray-400"}`}>Features</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title}
                className={`group border rounded-2xl p-7 transition-all duration-300
                  ${d
                    ? "bg-white/[0.03] border-white/10 hover:border-amber-500/30 hover:bg-white/[0.05]"
                    : "bg-white border-purple-100 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100"
                  }`}>
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2 tracking-wide">{f.title}</h3>
                <p className={`text-sm leading-relaxed ${d ? "text-gray-400" : "text-gray-500"}`}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 레이드 섹션 */}
      <section id="raids" className="relative z-10 px-8 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "var(--font-cinzel), serif" }}>
              지원 레이드
            </h2>
            <p className={`text-sm tracking-widest uppercase ${d ? "text-gray-500" : "text-gray-400"}`}>Supported Raids</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {RAIDS.map((raid) => (
              <div key={raid.name}
                className={`border rounded-xl p-5 transition-all duration-300 group
                  ${d
                    ? "bg-white/[0.03] border-white/10 hover:border-white/20"
                    : "bg-white border-purple-100 hover:border-purple-300 hover:shadow-sm"
                  }`}>
                <div className="flex items-center justify-between mb-3">
                  <Badge className={`text-xs ${d ? "bg-white/5 text-gray-400 border-white/10" : "bg-purple-50 text-purple-400 border-purple-100"}`}>
                    {raid.tag}
                  </Badge>
                  <span className={`text-xs font-mono ${d ? raid.darkColor : raid.lightColor}`}>
                    {raid.level}
                  </span>
                </div>
                <h3 className={`text-sm font-bold transition-colors
                  ${d ? "text-white group-hover:text-amber-400" : "text-gray-800 group-hover:text-purple-600"}`}>
                  {raid.name}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-8 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <div className={`border rounded-3xl p-12
            ${d
              ? "bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20"
              : "bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200"
            }`}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "var(--font-cinzel), serif" }}>
              지금 시작하세요
            </h2>
            <p className={`mb-8 leading-relaxed ${d ? "text-gray-400" : "text-gray-500"}`}>
              Discord 계정으로 로그인하고<br />
              레이드 모집 시스템을 무료로 사용해보세요.
            </p>
            <Button size="lg"
              className={`font-bold px-10 py-4 text-base tracking-wide
                ${d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"}`}
              onClick={() => window.location.href = "/login"}>
              Discord로 시작하기
            </Button>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className={`relative z-10 border-t px-8 py-8 text-center
        ${d ? "border-white/5 text-gray-600" : "border-purple-100 text-gray-400"}`}>
        <p className="text-xs tracking-widest uppercase mb-3">© 2026 로미니 (LostArk Raid Bot)</p>
        <div className="flex justify-center gap-6">
          <a href="/privacy"
            className={`text-xs transition-colors ${d ? "text-gray-600 hover:text-gray-400" : "text-gray-400 hover:text-gray-600"}`}>
            개인정보처리방침
          </a>
          <a href="/terms"
            className={`text-xs transition-colors ${d ? "text-gray-600 hover:text-gray-400" : "text-gray-400 hover:text-gray-600"}`}>
            이용약관
          </a>
        </div>
      </footer>
    </div>
  )
}