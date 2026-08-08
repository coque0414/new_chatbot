"use client"

import { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Plus, Calendar, MessageSquare, Settings, LogOut, LayoutList, CalendarRange } from "lucide-react"
import { getTheme, THEMES } from "@/lib/themes"

const NAV_ITEMS = [
  { icon: Calendar,     label: "대시보드",    href: "/dashboard",   key: "dashboard" },
  { icon: Plus,         label: "레이드 생성", href: "/raid-create",  key: "raid-create" },
  { icon: LayoutList,   label: "레이드 게시판", href: "/board",      key: "board" },
  { icon: CalendarRange, label: "고정 레이드", href: "/fixed-raids",  key: "fixed-raids" },
  { icon: MessageSquare,label: "AI 레이드 생성",   href: "/chat",         key: "chat" },
  { icon: Settings,     label: "봇 설정",     href: "/bot-settings", key: "bot-settings" },
]

/**
 * DashboardLayout
 *
 * Props:
 *   themeId    {string}   - 현재 테마 ID
 *   setThemeId {function} - 테마 변경 함수
 *   session    {object}   - NextAuth 세션 (user.name, user.email, user.image)
 *   activeNav  {string}   - 현재 활성 nav 키
 *   children   {ReactNode} - 메인 콘텐츠
 */
export default function DashboardLayout({ themeId, setThemeId, children, session, activeNav }) {
  const theme = getTheme(themeId)
  const d = theme.isDark
  const user = session?.user
  const [charInfo, setCharInfo] = useState(null)

  useEffect(() => {
    if (!session) return
    fetch("/api/characters")
      .then(r => r.json())
      .then(data => setCharInfo({ representCharacter: data.representCharacter, characters: data.characters || [] }))
      .catch(() => {})
  }, [session])

  return (
    <div className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: theme.bg, color: theme.text }}>

      {/* 전체 화면 배경 블러 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ backgroundColor: d ? "rgba(245,158,11,0.05)" : `${theme.accent}18` }} />
      </div>

      {/* 1280px 고정 컨테이너 */}
      <div className="max-w-[1280px] mx-auto flex min-h-screen">

        {/* 사이드바 */}
        <aside className="sticky top-0 h-screen w-60 flex-shrink-0 border-r z-20 flex flex-col overflow-y-auto"
          style={{ backgroundColor: theme.sidebar, borderColor: theme.border }}>

          {/* 로고 */}
          <div className="px-6 py-5 border-b" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚔️</span>
              <span className="text-sm font-bold tracking-widest uppercase"
                style={{ color: theme.accent, fontFamily: "var(--font-cinzel), serif" }}>
                LostArk
              </span>
            </div>
          </div>

          {/* 유저 정보 */}
          {user && (
            <div className="px-4 py-4 border-b" style={{ borderColor: theme.border }}>
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={user.image} />
                  <AvatarFallback style={{ backgroundColor: `${theme.accent}30`, color: theme.accent }}>
                    {user.name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: theme.text }}>{user.name}</p>
                  <p className="text-xs truncate" style={{ color: theme.subtext }}>{user.email}</p>
                </div>
              </div>

              {/* 대표 캐릭터 */}
              <div className="mt-3">
                {charInfo?.representCharacter ? (() => {
                  const rep = charInfo.characters.find(c => c.name === charInfo.representCharacter)
                  return (
                    <a href="/characters" className="block group">
                      <p className="text-xs mb-0.5" style={{ color: theme.subtext }}>대표 캐릭터</p>
                      <p className="text-sm font-medium truncate group-hover:underline" style={{ color: theme.accent }}>
                        ⚔️ {charInfo.representCharacter}
                        {rep?.class && (
                          <span className="font-normal text-xs ml-1" style={{ color: theme.subtext }}>
                            ({rep.class})
                          </span>
                        )}
                      </p>
                    </a>
                  )
                })() : (
                  <div>
                    <p className="text-xs mb-1.5" style={{ color: theme.subtext }}>캐릭터 미연동</p>
                    <a href="/characters"
                      className="inline-block text-xs px-2.5 py-1 rounded-lg font-medium transition-opacity hover:opacity-80"
                      style={{ backgroundColor: `${theme.accent}20`, color: theme.accent }}>
                      연동하기
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 네비게이션 */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeNav === item.key
              return (
                <a key={item.key} href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors
                    ${isActive
                      ? "font-medium"
                      : d
                        ? "text-gray-400 hover:bg-white/5 hover:text-white"
                        : "text-gray-500 hover:bg-black/5 hover:text-gray-800"
                    }`}
                  style={isActive ? { backgroundColor: `${theme.accent}20`, color: theme.accent } : {}}>
                  <item.icon size={16} />
                  {item.label}
                </a>
              )
            })}
          </nav>

          {/* 테마 선택 + 로그아웃 */}
          <div className="px-3 py-4 border-t space-y-3" style={{ borderColor: theme.border }}>
            <div>
              <p className="text-xs mb-2 px-1" style={{ color: theme.subtext }}>테마</p>
              <div className="flex flex-wrap gap-1.5 px-1">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setThemeId(t.id)}
                    title={t.label}
                    className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: t.isDark ? t.bg : t.accent,
                      borderColor: themeId === t.id ? theme.accent : "transparent",
                      outline: themeId === t.id ? `2px solid ${theme.accent}` : "none",
                      outlineOffset: "1px",
                    }}
                  />
                ))}
              </div>
            </div>
            {user && (
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors
                  ${d ? "text-gray-400 hover:bg-red-500/10 hover:text-red-400" : "text-gray-500 hover:bg-red-50 hover:text-red-500"}`}>
                <LogOut size={16} />
                로그아웃
              </button>
            )}
          </div>
        </aside>

        {/* 메인 콘텐츠 영역 */}
        <main className="flex-1 min-w-0 p-8 relative z-10">
          {children}
        </main>
      </div>
    </div>
  )
}
