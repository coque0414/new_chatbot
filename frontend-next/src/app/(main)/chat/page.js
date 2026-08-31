"use client"

import { useSession } from "next-auth/react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Send, Loader2, RotateCcw, CheckCircle2, ExternalLink } from "lucide-react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import GuildSelectDropdown from "@/components/GuildSelectDropdown"
import { getTheme } from "@/lib/themes"

const TURN_CAP_MESSAGE = "대화가 길어졌어요, 새로 시작해주세요."

const HOST_ROLE_LABEL = { dealer: "딜러", support: "서포터", none: "미참여" }

function DraftField({ label, value, d }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className={`text-xs mb-0.5 ${d ? "text-gray-500" : "text-gray-400"}`}>{label}</p>
      <p className={`text-sm ${value ? (d ? "text-white" : "text-gray-800") : (d ? "text-gray-600 italic" : "text-gray-300 italic")}`}>
        {value || "미정"}
      </p>
    </div>
  )
}

export default function ChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [themeId, setThemeId] = useState("dark")
  const [mounted, setMounted] = useState(false)

  // Discord 서버 선택 — raid-create/page.js와 동일한 패턴 (자동 선택 없음, 항상 수동 드롭다운)
  const [guilds, setGuilds] = useState([])
  const [loadingGuilds, setLoadingGuilds] = useState(false)
  const [selectedGuild, setSelectedGuild] = useState(null)
  const [guildSettings, setGuildSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(false)

  // 에이전트 대화 세션
  const [agentSessionId, setAgentSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState(null)
  const [ready, setReady] = useState(false)
  const [turnCapped, setTurnCapped] = useState(false)

  const [inputValue, setInputValue] = useState("")
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState(null)

  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState(null)
  const [createdRaid, setCreatedRaid] = useState(null)

  const scrollRef = useRef(null)

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

  useEffect(() => {
    if (status === "authenticated") {
      setLoadingGuilds(true)
      fetch("/api/discord/guilds")
        .then(res => res.json())
        .then(data => { if (data.guilds) setGuilds(data.guilds) })
        .finally(() => setLoadingGuilds(false))
    }
  }, [status])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, sending])

  const handleGuildSelect = async (guild) => {
    setSelectedGuild(guild)
    setGuildSettings(null)
    setLoadingSettings(true)
    try {
      const res = await fetch(`/api/discord/guild-settings?guildId=${guild.id}`)
      const data = await res.json()
      setGuildSettings(data.settings || {})
    } catch {
      setGuildSettings({})
    } finally {
      setLoadingSettings(false)
    }
  }

  const resetSession = () => {
    setAgentSessionId(null)
    setMessages([])
    setDraft(null)
    setReady(false)
    setTurnCapped(false)
    setChatError(null)
    setConfirmError(null)
    setCreatedRaid(null)
    setInputValue("")
  }

  const sendMessage = async () => {
    const text = inputValue.trim()
    if (!text || !selectedGuild || sending || turnCapped) return

    setSending(true)
    setChatError(null)
    setMessages(prev => [...prev, { role: "user", content: text }])
    setInputValue("")

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: agentSessionId, message: text, guildId: selectedGuild.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setChatError(data.error || "메시지 전송에 실패했습니다.")
        return
      }
      setAgentSessionId(data.sessionId)
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }])
      setDraft(data.draft)
      setReady(data.ready)
      if (data.reply === TURN_CAP_MESSAGE) setTurnCapped(true)
    } catch {
      setChatError("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setSending(false)
    }
  }

  const handleConfirm = async () => {
    if (!agentSessionId || confirming) return
    setConfirming(true)
    setConfirmError(null)
    try {
      const res = await fetch("/api/agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: agentSessionId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setConfirmError(data.error || "레이드 생성에 실패했습니다.")
        return
      }
      setCreatedRaid(data.raid)
    } catch {
      setConfirmError("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setConfirming(false)
    }
  }

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

  const inputClass = `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors
    ${d
      ? "bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50"
      : "bg-white border-purple-100 text-gray-800 placeholder-gray-400 focus:border-purple-300"
    }`

  const primaryBtnClass = d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"

  return (
    <DashboardLayout themeId={themeId} setThemeId={setThemeId} session={session} activeNav="chat">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-cinzel), serif" }}>
          레이드 만들기
        </h1>
        <p className={`text-sm mt-0.5 ${d ? "text-gray-400" : "text-gray-500"}`}>
          채팅으로 레이드 정보를 알려주면 대신 예약을 만들어드려요
        </p>
      </div>

      {/* Discord 서버 선택 — components/GuildSelectDropdown.js (raid-create/page.js와 공유) */}
      <div className="mb-6 max-w-md">
        <GuildSelectDropdown
          guilds={guilds}
          loadingGuilds={loadingGuilds}
          selectedGuild={selectedGuild}
          guildSettings={guildSettings}
          guildSettingsLoading={loadingSettings}
          onGuildChange={(guild) => {
            resetSession()
            if (guild) handleGuildSelect(guild)
            else { setSelectedGuild(null); setGuildSettings(null) }
          }}
          d={d}
          inputClass={inputClass}
        />
      </div>

      {!selectedGuild ? (
        <div className={`rounded-2xl border p-10 text-center text-sm ${d ? "border-white/10 text-gray-500" : "border-purple-100 text-gray-400"}`}>
          먼저 Discord 서버를 선택해주세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

          {/* 좌측: 채팅 */}
          <div className={`rounded-2xl border flex flex-col h-[70vh] ${d ? "bg-white/5 border-white/10" : "bg-white border-purple-100"}`}>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.length === 0 && (
                <div className={`text-sm text-center mt-10 ${d ? "text-gray-500" : "text-gray-400"}`}>
                  &quot;오늘 밤 9시에 카제로스 하드 만들어줘&quot;처럼 편하게 말해보세요.
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap
                    ${m.role === "user"
                      ? d ? "bg-amber-500 text-black" : "bg-purple-600 text-white"
                      : d ? "bg-white/10 text-gray-100" : "bg-purple-50 text-gray-800"
                    }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className={`px-4 py-2.5 rounded-2xl text-sm flex items-center gap-2 ${d ? "bg-white/10 text-gray-400" : "bg-purple-50 text-gray-500"}`}>
                    <Loader2 size={14} className="animate-spin" />생각 중...
                  </div>
                </div>
              )}
            </div>

            {chatError && (
              <div className={`mx-5 mb-2 px-3 py-2 rounded-lg text-xs ${d ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"}`}>
                ⚠️ {chatError}
              </div>
            )}

            <div className="p-4 border-t" style={{ borderColor: theme.border }}>
              {turnCapped ? (
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-sm ${d ? "text-gray-400" : "text-gray-500"}`}>대화가 길어졌어요, 새로 시작해주세요.</p>
                  <Button onClick={resetSession} className={primaryBtnClass}>
                    <RotateCcw size={14} className="mr-1.5" />새 대화 시작
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    disabled={sending}
                    placeholder="메시지를 입력하세요..."
                    className={inputClass} />
                  <Button onClick={sendMessage} disabled={sending || !inputValue.trim()} className={`px-4 ${primaryBtnClass}`}>
                    <Send size={16} />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 우측: 초안 패널 (읽기 전용) */}
          <div className={`rounded-2xl border p-5 sticky top-8 ${d ? "bg-white/5 border-white/10" : "bg-white border-purple-100"}`}>
            {createdRaid ? (
              <div className="text-center py-6">
                <CheckCircle2 size={40} className={`mx-auto mb-3 ${d ? "text-emerald-400" : "text-emerald-500"}`} />
                <p className={`text-sm font-medium mb-4 ${d ? "text-white" : "text-gray-800"}`}>레이드가 생성됐어요!</p>
                <a href={`/raids/${createdRaid._id}`}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium mb-4 underline ${d ? "text-amber-400" : "text-purple-600"}`}>
                  레이드 보러가기 <ExternalLink size={14} />
                </a>
                <Button onClick={resetSession} className={`w-full ${primaryBtnClass}`}>
                  새 레이드 만들기
                </Button>
              </div>
            ) : (
              <>
                <p className={`text-sm font-medium mb-4 ${d ? "text-white" : "text-gray-800"}`}>레이드 초안</p>

                <DraftField d={d} label="레이드" value={
                  draft?.raidAlias
                    ? `${draft.raidAlias}${draft.difficulty ? ` · ${draft.difficulty}` : ""}${draft.difficultyLevel ? ` (${draft.difficultyLevel})` : ""}`
                    : null
                } />
                <DraftField d={d} label="일정" value={
                  draft?.isMobaChul
                    ? "모바출 (인원 차면 바로 출발)"
                    : (draft?.date && draft?.time) ? `${draft.date} ${draft.time}` : null
                } />
                <DraftField d={d} label="인원" value={draft?.maxPlayers ? `${draft.maxPlayers}명` : null} />
                <DraftField d={d} label="호스트" value={
                  draft?.hostRole
                    ? `${HOST_ROLE_LABEL[draft.hostRole] || draft.hostRole}${draft.hostCharacterName ? ` · ${draft.hostCharacterName}` : ""}`
                    : null
                } />

                {confirmError && (
                  <div className={`mt-3 px-3 py-2 rounded-lg text-xs ${d ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"}`}>
                    ⚠️ {confirmError}
                  </div>
                )}

                <Button
                  onClick={handleConfirm}
                  disabled={!agentSessionId || confirming}
                  className={`w-full mt-5 ${ready ? primaryBtnClass : d ? "bg-white/10 hover:bg-white/15 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}>
                  {confirming
                    ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />생성 중...</span>
                    : ready ? "이대로 만들기" : "이대로 만들기 (미완성)"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
