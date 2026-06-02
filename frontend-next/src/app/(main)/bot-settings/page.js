"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, Hash, Plus, Check, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { getTheme } from "@/lib/themes"

export default function BotSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [themeId, setThemeId] = useState("dark")
  const [mounted, setMounted] = useState(false)

  // 서버 목록 (봇 + 유저 교집합)
  const [guilds, setGuilds] = useState([])
  const [loadingGuilds, setLoadingGuilds] = useState(false)

  // 서버별 설정 맵: guildId → settings
  const [settingsMap, setSettingsMap] = useState({})

  // 서버별 채널 맵: guildId → channels[]
  const [channelsMap, setChannelsMap] = useState({})
  const [loadingChannels, setLoadingChannels] = useState({}) // guildId → bool

  // 서버별 저장 상태: guildId → { saving, result }
  const [saveState, setSaveState] = useState({})

  // 서버별 드래프트(선택 중) 상태
  const [draftMap, setDraftMap] = useState({})

  // 확장된 카드 상태
  const [expandedGuild, setExpandedGuild] = useState(null)

  // 채널 생성 기능 (기존 유지)
  const [channelName, setChannelName] = useState("로아-레이드-모집")
  const [selectedGuildForCreate, setSelectedGuildForCreate] = useState(null)
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState(null)

  // 레이드 공고 정리
  const [cleanupRaids, setCleanupRaids] = useState(null)   // null=미조회, []=조회완료
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupChecked, setCleanupChecked] = useState(new Set())
  const [cleanupMode, setCleanupMode] = useState("both")
  const [cleanupResult, setCleanupResult] = useState(null)

  const toggleCleanupCheck = (id) => {
    setCleanupChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCleanupPreview = async () => {
    setCleanupLoading(true)
    setCleanupResult(null)
    try {
      const res = await fetch("/api/raids/cleanup?preview=true")
      const data = await res.json()
      const raids = data.raids || []
      setCleanupRaids(raids)
      setCleanupChecked(new Set(raids.map(r => r._id)))
    } catch (e) {
      setCleanupRaids([])
    } finally {
      setCleanupLoading(false)
    }
  }

  const handleCleanupDelete = async () => {
    const selected = [...cleanupChecked]
    const n = selected.length
    const confirmMsg = {
      discord: `선택한 ${n}개의 Discord 메시지를 삭제합니다.`,
      web: `선택한 ${n}개의 레이드를 웹에서 삭제합니다.`,
      both: `선택한 ${n}개의 레이드와 Discord 메시지를 모두 삭제합니다.`,
    }[cleanupMode]
    if (!window.confirm(confirmMsg)) return

    const raidIds = selected.map(id => {
      const raid = cleanupRaids.find(r => r._id === id)
      return { id, isTrainRaid: !!raid?.isTrainRaid }
    })

    setCleanupLoading(true)
    try {
      const res = await fetch("/api/raids/cleanup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: cleanupMode, raidIds }),
      })
      const data = await res.json()
      setCleanupResult({ ...data, mode: cleanupMode })
      setCleanupRaids(null)
      setCleanupChecked(new Set())
    } catch (e) {
      setCleanupResult({ error: e.message, mode: cleanupMode })
    } finally {
      setCleanupLoading(false)
    }
  }

  const resetCleanup = () => {
    setCleanupRaids(null)
    setCleanupChecked(new Set())
    setCleanupResult(null)
  }

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
    if (status === "authenticated") loadGuildsAndSettings()
  }, [status])

  const loadGuildsAndSettings = async () => {
    setLoadingGuilds(true)
    try {
      const res = await fetch("/api/discord/guilds")
      const data = await res.json()
      if (!data.guilds) return
      setGuilds(data.guilds)

      // 설정 일괄 조회
      const ids = data.guilds.map(g => g.id).join(",")
      const settingsRes = await fetch(`/api/discord/guild-settings/all?guildIds=${ids}`)
      const settingsData = await settingsRes.json()
      if (settingsData.settingsMap) setSettingsMap(settingsData.settingsMap)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingGuilds(false)
    }
  }

  const loadChannels = async (guildId) => {
    if (channelsMap[guildId]) return // 이미 로드됨
    setLoadingChannels(prev => ({ ...prev, [guildId]: true }))
    try {
      const res = await fetch(`/api/discord/channels?guildId=${guildId}`)
      const data = await res.json()
      if (data.channels) {
        setChannelsMap(prev => ({ ...prev, [guildId]: data.channels }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingChannels(prev => ({ ...prev, [guildId]: false }))
    }
  }

  const handleExpandGuild = async (guildId) => {
    if (expandedGuild === guildId) {
      setExpandedGuild(null)
      return
    }
    setExpandedGuild(guildId)
    await loadChannels(guildId)
  }

  const getDraft = (guildId) => {
    const settings = settingsMap[guildId] || {}
    return draftMap[guildId] || {
      announcementChannelId:   settings.announcementChannelId   || "",
      announcementChannelName: settings.announcementChannelName || "",
      createChannelId:         settings.createChannelId         || "",
      createChannelName:       settings.createChannelName       || "",
      voiceChannelEnabled:     settings.voiceChannelEnabled !== false,
      fixedRaidDmEnabled:     settings.fixedRaidDmEnabled !== false,
      fixedRaidNotifyEnabled: settings.fixedRaidNotifyEnabled !== false,
    }
  }

  const updateDraft = (guildId, key, value, name) => {
    setDraftMap(prev => ({
      ...prev,
      [guildId]: {
        ...getDraft(guildId),
        [key]: value,
        ...(name !== undefined ? { [key.replace("Id", "Name").replace("ChannelId", "ChannelName")]: name } : {}),
      }
    }))
  }

  const handleSave = async (guild) => {
    const draft = getDraft(guild.id)
    setSaveState(prev => ({ ...prev, [guild.id]: { saving: true, result: null } }))
    try {
      const res = await fetch("/api/discord/guild-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId:                guild.id,
          guildName:              guild.name,
          guildIcon:              guild.icon || null,
          announcementChannelId:  draft.announcementChannelId  || null,
          announcementChannelName:draft.announcementChannelName || null,
          createChannelId:        draft.createChannelId        || null,
          createChannelName:      draft.createChannelName      || null,
          voiceChannelEnabled:    draft.voiceChannelEnabled !== false,
          fixedRaidDmEnabled:     draft.fixedRaidDmEnabled !== false,
          fixedRaidNotifyEnabled: draft.fixedRaidNotifyEnabled !== false,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSettingsMap(prev => ({ ...prev, [guild.id]: data.settings }))
        setDraftMap(prev => { const next = { ...prev }; delete next[guild.id]; return next })
        setSaveState(prev => ({ ...prev, [guild.id]: { saving: false, result: { success: true } } }))
        setTimeout(() => setSaveState(prev => ({ ...prev, [guild.id]: { saving: false, result: null } })), 3000)
      } else {
        setSaveState(prev => ({ ...prev, [guild.id]: { saving: false, result: { success: false, error: data.error } } }))
      }
    } catch (e) {
      setSaveState(prev => ({ ...prev, [guild.id]: { saving: false, result: { success: false, error: e.message } } }))
    }
  }

  const handlePostSetup = async (guildId) => {
    const draft = getDraft(guildId)
    const channelId = draft.createChannelId
    if (!channelId) return
    setSaveState(prev => ({ ...prev, [`setup_${guildId}`]: { saving: true, result: null } }))
    try {
      const res = await fetch("/api/discord/setup-raid-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, guildId }),
      })
      const data = await res.json()
      setSaveState(prev => ({
        ...prev,
        [`setup_${guildId}`]: { saving: false, result: data.success ? { success: true } : { success: false, error: data.error } }
      }))
      setTimeout(() => setSaveState(prev => ({ ...prev, [`setup_${guildId}`]: { saving: false, result: null } })), 3000)
    } catch (e) {
      setSaveState(prev => ({ ...prev, [`setup_${guildId}`]: { saving: false, result: { success: false, error: e.message } } }))
    }
  }

  const handleCreateChannel = async () => {
    if (!selectedGuildForCreate) return
    setCreating(true)
    setCreateResult(null)
    try {
      const res = await fetch("/api/discord/create-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: selectedGuildForCreate.id, channelName: channelName || "로아-레이드-모집" }),
      })
      const data = await res.json()
      if (data.success) {
        setCreateResult({ success: true, channel: data.channel })
        // 채널 캐시 초기화 → 다음 확장 시 재로드
        setChannelsMap(prev => { const next = { ...prev }; delete next[selectedGuildForCreate.id]; return next })
      } else {
        setCreateResult({ success: false, error: data.error })
      }
    } catch (e) {
      setCreateResult({ success: false, error: e.message })
    } finally {
      setCreating(false)
    }
  }

  if (!mounted || status === "loading") return null
  if (!session) return null

  const theme = getTheme(themeId)
  const d = theme.isDark

  const inputClass = `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors
    ${d
      ? "bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50"
      : "bg-white border-purple-100 text-gray-800 placeholder-gray-400 focus:border-purple-300"
    }`

  return (
    <DashboardLayout themeId={themeId} setThemeId={setThemeId} session={session} activeNav="bot-settings">
      <div className="max-w-2xl">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <a href="/dashboard"
            className={`p-2 rounded-xl transition-colors ${d ? "hover:bg-white/10" : "hover:bg-purple-100"}`}>
            <ChevronLeft size={18} />
          </a>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-cinzel), serif" }}>
              봇 설정
            </h1>
            <p className={`text-sm mt-0.5 ${d ? "text-gray-400" : "text-gray-500"}`}>
              서버별 공고 채널과 생성 채널을 지정하세요
            </p>
          </div>
          <button onClick={loadGuildsAndSettings}
            className={`ml-auto p-2 rounded-xl transition-colors ${d ? "hover:bg-white/10 text-gray-400" : "hover:bg-purple-100 text-gray-500"}`}>
            <RefreshCw size={16} className={loadingGuilds ? "animate-spin" : ""} />
          </button>
        </div>

        {/* 새 서버에 봇 추가하기 */}
        <Card className={`border p-5 mb-4 flex items-center gap-4
          ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0
            ${d ? "bg-amber-500/15" : "bg-purple-100"}`}>
            🤖
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">새 서버에 봇 추가하기</p>
            <p className={`text-xs mt-0.5 ${d ? "text-gray-400" : "text-gray-500"}`}>
              봇을 추가할 서버에서 관리자 권한이 필요합니다
            </p>
          </div>
          <Button
            size="sm"
            className={`flex-shrink-0 font-bold text-xs px-4
              ${d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"}`}
            onClick={async () => {
              try {
                const res = await fetch("/api/discord/bot-invite")
                const data = await res.json()
                if (data.inviteUrl) window.open(data.inviteUrl, "_blank")
              } catch {}
            }}>
            봇 추가하기
          </Button>
        </Card>

        {/* 봇 상태 카드 */}
        <Card className={`border p-5 mb-6 flex items-center gap-4
          ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg
            ${d ? "bg-amber-500/15" : "bg-purple-100"}`}>
            🤖
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">LostArk Guide Bot</p>
            <p className={`text-xs mt-0.5 ${d ? "text-gray-400" : "text-gray-500"}`}>
              {loadingGuilds ? "서버 목록 불러오는 중..." : guilds.length > 0
                ? `${guilds.length}개 서버에 연결됨`
                : "서버 연결 없음 — 봇을 서버에 초대하세요"
              }
            </p>
          </div>
          <Badge className={`text-xs ${guilds.length > 0
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            : "bg-gray-500/15 text-gray-400 border-gray-500/30"}`}>
            {loadingGuilds ? "● 연결 중..." : guilds.length > 0 ? "● 온라인" : "● 오프라인"}
          </Badge>
        </Card>

        {/* ── 서버별 채널 설정 ──────────────────────────────── */}
        <div className="mb-2">
          <h2 className={`text-sm font-semibold mb-3 ${d ? "text-gray-300" : "text-gray-600"}`}>
            서버별 채널 설정
          </h2>
        </div>

        {loadingGuilds ? (
          <div className={`px-4 py-6 rounded-xl border text-sm text-center animate-pulse
            ${d ? "border-white/10 text-gray-500" : "border-purple-100 text-gray-400"}`}>
            서버 목록 불러오는 중...
          </div>
        ) : guilds.length === 0 ? (
          <div className={`px-4 py-6 rounded-xl border text-sm text-center
            ${d ? "border-white/10 text-gray-500" : "border-purple-100 text-gray-400"}`}>
            봇이 추가된 서버가 없어요.<br />
            <span className={`text-xs ${d ? "text-gray-600" : "text-gray-300"}`}>
              Discord 개발자 포털에서 봇을 서버에 초대해주세요.
            </span>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {guilds.map((guild) => {
              const settings  = settingsMap[guild.id] || {}
              const draft     = getDraft(guild.id)
              const channels  = channelsMap[guild.id] || []
              const isLoading = loadingChannels[guild.id]
              const isExpanded = expandedGuild === guild.id
              const sv = saveState[guild.id] || {}
              const svSetup = saveState[`setup_${guild.id}`] || {}

              const hasAnnouncement = settings.announcementChannelId
              const hasCreate = settings.createChannelId

              return (
                <Card key={guild.id} className={`border overflow-hidden
                  ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>

                  {/* 카드 헤더 — 클릭으로 확장/축소 */}
                  <button
                    onClick={() => handleExpandGuild(guild.id)}
                    className={`w-full flex items-center gap-3 p-4 text-left transition-colors
                      ${d ? "hover:bg-white/5" : "hover:bg-purple-50/50"}`}>
                    {guild.icon ? (
                      <img src={guild.icon} alt={guild.name} className="w-8 h-8 rounded-full flex-shrink-0" />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                        ${d ? "bg-white/10 text-gray-300" : "bg-purple-100 text-purple-600"}`}>
                        {guild.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{guild.name}</p>
                      <div className="flex gap-2 mt-0.5">
                        {hasAnnouncement
                          ? <span className="text-xs text-emerald-400">📢 #{settings.announcementChannelName || "공고채널"}</span>
                          : <span className={`text-xs ${d ? "text-gray-600" : "text-gray-300"}`}>📢 공고 채널 미설정</span>
                        }
                        {hasCreate
                          ? <span className="text-xs text-emerald-400">🎮 #{settings.createChannelName || "생성채널"}</span>
                          : <span className={`text-xs ${d ? "text-gray-600" : "text-gray-300"}`}>🎮 생성 채널 미설정</span>
                        }
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronUp size={16} className={d ? "text-gray-500" : "text-gray-400"} />
                      : <ChevronDown size={16} className={d ? "text-gray-500" : "text-gray-400"} />
                    }
                  </button>

                  {/* 확장 패널 */}
                  {isExpanded && (
                    <div className={`border-t px-4 pb-4 pt-4 space-y-4
                      ${d ? "border-white/10" : "border-purple-100"}`}>

                      {isLoading ? (
                        <p className={`text-xs text-center py-2 ${d ? "text-gray-500" : "text-gray-400"}`}>
                          채널 목록 불러오는 중...
                        </p>
                      ) : (
                        <>
                          {/* 공고 채널 */}
                          <div>
                            <label className={`block text-xs font-medium mb-1.5 ${d ? "text-gray-400" : "text-gray-600"}`}>
                              📢 공고 채널 — 레이드 모집 공고가 올라갈 채널
                            </label>
                            <select
                              value={draft.announcementChannelId}
                              onChange={e => {
                                const ch = channels.find(c => c.id === e.target.value)
                                updateDraft(guild.id, "announcementChannelId", e.target.value, ch?.name || "")
                              }}
                              className={inputClass}>
                              <option value="">채널 선택 (선택 안 하면 제한 없음)</option>
                              {channels.map(ch => (
                                <option key={ch.id} value={ch.id}>#{ch.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* 생성 채널 */}
                          <div>
                            <label className={`block text-xs font-medium mb-1.5 ${d ? "text-gray-400" : "text-gray-600"}`}>
                              🎮 생성 채널 — Discord에서 레이드 모집을 생성할 전용 채널
                            </label>
                            <select
                              value={draft.createChannelId}
                              onChange={e => {
                                const ch = channels.find(c => c.id === e.target.value)
                                updateDraft(guild.id, "createChannelId", e.target.value, ch?.name || "")
                              }}
                              className={inputClass}>
                              <option value="">채널 선택 (선택 안 하면 어디서든 생성 가능)</option>
                              {channels.map(ch => (
                                <option key={ch.id} value={ch.id}>#{ch.name}</option>
                              ))}
                            </select>
                            {draft.createChannelId && (
                              <button
                                onClick={() => handlePostSetup(guild.id)}
                                disabled={svSetup.saving}
                                className={`mt-2 text-xs px-3 py-1.5 rounded-lg border transition-colors
                                  ${d ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10" : "border-purple-300 text-purple-600 hover:bg-purple-50"}`}>
                                {svSetup.saving ? "게시 중..." : "📋 생성 채널에 안내 메시지 게시"}
                              </button>
                            )}
                            {svSetup.result && (
                              <p className={`text-xs mt-1 ${svSetup.result.success ? "text-emerald-400" : "text-red-400"}`}>
                                {svSetup.result.success ? "✅ 안내 메시지가 게시되었습니다." : `❌ ${svSetup.result.error}`}
                              </p>
                            )}
                          </div>

                          {/* 음성채널 자동 생성 */}
                          <div className={`flex items-center justify-between px-4 py-3 rounded-xl border
                            ${d ? "bg-white/[0.02] border-white/10" : "bg-purple-50/30 border-purple-100"}`}>
                            <div>
                              <p className={`text-sm font-medium ${d ? "text-gray-200" : "text-gray-700"}`}>🎙️ 음성채널 자동 생성</p>
                              <p className={`text-xs mt-0.5 ${d ? "text-gray-500" : "text-gray-400"}`}>레이드 시작 시 음성채널을 자동으로 생성합니다</p>
                            </div>
                            <button
                              onClick={() => updateDraft(guild.id, "voiceChannelEnabled", draft.voiceChannelEnabled === false)}
                              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
                                ${draft.voiceChannelEnabled !== false
                                  ? d ? "bg-amber-500" : "bg-purple-600"
                                  : d ? "bg-white/20" : "bg-gray-200"
                                }`}>
                              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                                ${draft.voiceChannelEnabled !== false ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>

                          {/* 고정 레이드 알림 */}
                          <div className={`border-t pt-4 ${d ? "border-white/10" : "border-purple-100"}`}>
                            <p className={`text-xs font-semibold mb-3 ${d ? "text-gray-400" : "text-gray-600"}`}>
                              고정 레이드 알림
                            </p>
                            <div className="space-y-3">
                              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border
                                ${d ? "bg-white/[0.02] border-white/10" : "bg-purple-50/30 border-purple-100"}`}>
                                <div>
                                  <p className={`text-sm font-medium ${d ? "text-gray-200" : "text-gray-700"}`}>📩 당일 개인 DM 알림</p>
                                  <p className={`text-xs mt-0.5 ${d ? "text-gray-500" : "text-gray-400"}`}>고정 레이드 당일 참가자에게 오늘의 레이드 일정을 DM으로 발송합니다</p>
                                </div>
                                <button
                                  onClick={() => updateDraft(guild.id, "fixedRaidDmEnabled", draft.fixedRaidDmEnabled === false)}
                                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
                                    ${draft.fixedRaidDmEnabled !== false
                                      ? d ? "bg-amber-500" : "bg-purple-600"
                                      : d ? "bg-white/20" : "bg-gray-200"
                                    }`}>
                                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                                    ${draft.fixedRaidDmEnabled !== false ? "translate-x-5" : "translate-x-0"}`} />
                                </button>
                              </div>
                              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border
                                ${d ? "bg-white/[0.02] border-white/10" : "bg-purple-50/30 border-purple-100"}`}>
                                <div>
                                  <p className={`text-sm font-medium ${d ? "text-gray-200" : "text-gray-700"}`}>📢 수요일 공지 알림</p>
                                  <p className={`text-xs mt-0.5 ${d ? "text-gray-500" : "text-gray-400"}`}>매주 수요일 오전 10시 이번 주 고정 레이드 일정을 공고 채널에 발송합니다</p>
                                </div>
                                <button
                                  onClick={() => updateDraft(guild.id, "fixedRaidNotifyEnabled", draft.fixedRaidNotifyEnabled === false)}
                                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
                                    ${draft.fixedRaidNotifyEnabled !== false
                                      ? d ? "bg-amber-500" : "bg-purple-600"
                                      : d ? "bg-white/20" : "bg-gray-200"
                                    }`}>
                                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                                    ${draft.fixedRaidNotifyEnabled !== false ? "translate-x-5" : "translate-x-0"}`} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* 저장 결과 */}
                          {sv.result && (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs
                              ${sv.result.success
                                ? d ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                                : d ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
                              }`}>
                              {sv.result.success ? <Check size={12} /> : <AlertCircle size={12} />}
                              {sv.result.success ? "설정이 저장되었습니다." : `오류: ${sv.result.error}`}
                            </div>
                          )}

                          {/* 저장 버튼 */}
                          <Button
                            disabled={sv.saving}
                            onClick={() => handleSave(guild)}
                            className={`w-full py-2.5 text-sm font-bold
                              ${d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"}
                              ${sv.saving ? "opacity-60" : ""}`}>
                            {sv.saving ? (
                              <span className="flex items-center gap-2">
                                <RefreshCw size={13} className="animate-spin" />저장 중...
                              </span>
                            ) : "설정 저장"}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* ── 봇 전용 채널 생성 ──────────────────────────────── */}
        <Card className={`border p-6 space-y-5
          ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
          <div>
            <h2 className="font-bold text-base mb-1">봇 전용 채널 생성</h2>
            <p className={`text-xs ${d ? "text-gray-400" : "text-gray-500"}`}>
              선택한 서버에 레이드 모집 전용 채널을 자동으로 만들어요
            </p>
          </div>

          {/* 서버 선택 */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${d ? "text-gray-300" : "text-gray-700"}`}>
              서버 선택 *
            </label>
            <div className="space-y-2">
              {guilds.map((guild) => (
                <div key={guild.id}
                  onClick={() => setSelectedGuildForCreate(guild)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all
                    ${selectedGuildForCreate?.id === guild.id
                      ? d ? "border-amber-500/50 bg-amber-500/10" : "border-purple-400 bg-purple-50"
                      : d ? "border-white/10 hover:border-white/20 bg-white/[0.02]" : "border-purple-100 hover:border-purple-300 bg-white"
                    }`}>
                  {guild.icon
                    ? <img src={guild.icon} alt={guild.name} className="w-7 h-7 rounded-full" />
                    : <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                        ${d ? "bg-white/10 text-gray-300" : "bg-purple-100 text-purple-600"}`}>
                        {guild.name[0]}
                      </div>
                  }
                  <span className="text-sm font-medium flex-1">{guild.name}</span>
                  {selectedGuildForCreate?.id === guild.id && (
                    <Check size={15} className={d ? "text-amber-400" : "text-purple-600"} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 채널명 */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${d ? "text-gray-300" : "text-gray-700"}`}>
              <Hash size={14} className="inline mr-1" />채널 이름
            </label>
            <input
              type="text"
              value={channelName}
              onChange={e => setChannelName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="로아-레이드-모집"
              className={inputClass}
            />
            <p className={`text-xs mt-1.5 ${d ? "text-gray-500" : "text-gray-400"}`}>
              소문자와 하이픈(-)만 사용 가능해요
            </p>
          </div>

          {createResult && (
            <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm
              ${createResult.success
                ? d ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                : d ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-red-50 border-red-200 text-red-600"
              }`}>
              {createResult.success ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
              {createResult.success
                ? <p><span className="font-medium">#{createResult.channel.name}</span> 채널이 생성됐어요!</p>
                : <p>오류: {createResult.error}</p>
              }
            </div>
          )}

          <Button
            disabled={!selectedGuildForCreate || creating}
            onClick={handleCreateChannel}
            className={`w-full py-3 font-bold
              ${selectedGuildForCreate && !creating
                ? d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"
                : "opacity-40 cursor-not-allowed bg-gray-500 text-white"
              }`}>
            {creating ? (
              <span className="flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" />채널 생성 중...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus size={14} />봇 전용 채널 생성
              </span>
            )}
          </Button>
        </Card>

        {/* ── 레이드 공고 정리 ──────────────────────────────── */}
        <Card className={`border p-6 mt-6 space-y-4
          ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
          <div>
            <h2 className="font-bold text-base mb-1">🗑️ 레이드 공고 정리</h2>
            <p className={`text-xs ${d ? "text-gray-400" : "text-gray-500"}`}>
              기한이 지났거나 취소된 레이드를 웹과 Discord에서 정리합니다.
            </p>
          </div>

          {/* 완료 결과 */}
          {cleanupResult && (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm
                ${cleanupResult.error
                  ? d ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-red-50 border-red-200 text-red-600"
                  : d ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                }`}>
                {cleanupResult.error
                  ? <><AlertCircle size={14} className="shrink-0" /> 오류: {cleanupResult.error}</>
                  : cleanupResult.mode === "discord"
                    ? <><Check size={14} className="shrink-0" /> Discord 메시지 {cleanupResult.discordDeleted}개 삭제 완료</>
                    : cleanupResult.mode === "web"
                      ? <><Check size={14} className="shrink-0" /> 웹 레이드 {cleanupResult.webDeleted}개 삭제 완료</>
                      : <><Check size={14} className="shrink-0" /> 웹 {cleanupResult.webDeleted}개 / Discord {cleanupResult.discordDeleted}개 삭제 완료</>
                }
              </div>
              <button onClick={resetCleanup}
                className={`text-xs ${d ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}>
                닫기
              </button>
            </div>
          )}

          {/* 초기: 정리 대상 확인 버튼 */}
          {!cleanupResult && cleanupRaids === null && (
            <Button
              disabled={cleanupLoading}
              onClick={handleCleanupPreview}
              className={`w-full py-2.5 text-sm font-medium border
                ${d ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10" : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"}
                ${cleanupLoading ? "opacity-60" : ""}`}>
              {cleanupLoading
                ? <span className="flex items-center gap-2"><RefreshCw size={13} className="animate-spin" />확인 중...</span>
                : <span className="flex items-center gap-2"><Trash2 size={13} />정리 대상 확인</span>
              }
            </Button>
          )}

          {/* 대상 없음 */}
          {!cleanupResult && cleanupRaids?.length === 0 && (
            <div className="space-y-3">
              <p className={`text-sm text-center py-3 ${d ? "text-gray-500" : "text-gray-400"}`}>
                정리할 레이드가 없습니다. ✨
              </p>
              <button onClick={resetCleanup}
                className={`text-xs ${d ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}>
                닫기
              </button>
            </div>
          )}

          {/* 체크박스 목록 + 모드 선택 + 삭제 */}
          {!cleanupResult && cleanupRaids?.length > 0 && (
            <div className="space-y-4">
              {/* 전체 선택/해제 */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${d ? "text-gray-400" : "text-gray-600"}`}>
                  삭제 대상 {cleanupRaids.length}개
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCleanupChecked(new Set(cleanupRaids.map(r => r._id)))}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors
                      ${d ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-purple-100 text-gray-500 hover:bg-purple-50"}`}>
                    전체 선택
                  </button>
                  <button
                    onClick={() => setCleanupChecked(new Set())}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors
                      ${d ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-purple-100 text-gray-500 hover:bg-purple-50"}`}>
                    전체 해제
                  </button>
                </div>
              </div>

              {/* 체크박스 목록 */}
              <div className={`rounded-xl border divide-y overflow-hidden
                ${d ? "border-white/10 divide-white/10" : "border-purple-100 divide-purple-100"}`}>
                {cleanupRaids.map((raid) => (
                  <label key={raid._id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors
                      ${cleanupChecked.has(raid._id)
                        ? d ? "bg-amber-500/5" : "bg-purple-50/60"
                        : d ? "bg-white/[0.02] hover:bg-white/5" : "bg-white hover:bg-purple-50/30"
                      }`}>
                    <input
                      type="checkbox"
                      checked={cleanupChecked.has(raid._id)}
                      onChange={() => toggleCleanupCheck(raid._id)}
                      className="w-4 h-4 accent-purple-600 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${d ? "text-white" : "text-gray-800"}`}>
                          {raid.isTrainRaid ? raid.trainLabel : `${raid.raidAlias} ${raid.difficulty}`}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full
                          ${raid.status === "취소"
                            ? d ? "bg-red-500/15 text-red-400" : "bg-red-100 text-red-600"
                            : raid.status === "출발완료"
                              ? d ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                              : d ? "bg-gray-500/15 text-gray-400" : "bg-gray-100 text-gray-500"
                          }`}>
                          {raid.status || "기한만료"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {!raid.isMobaChul && raid.date && (
                          <span className={`text-xs ${d ? "text-gray-500" : "text-gray-400"}`}>
                            {raid.date} {raid.time}
                          </span>
                        )}
                        <span className={`text-xs ${raid.discordMessageId
                          ? d ? "text-amber-400/70" : "text-purple-400"
                          : d ? "text-gray-600" : "text-gray-300"
                        }`}>
                          Discord {raid.discordMessageId ? "있음" : "없음"}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {/* 삭제 방식 선택 */}
              <div className={`px-4 py-3 rounded-xl border space-y-2
                ${d ? "bg-white/5 border-white/10" : "bg-purple-50/50 border-purple-100"}`}>
                <p className={`text-xs font-medium mb-2 ${d ? "text-gray-400" : "text-gray-600"}`}>삭제 방식</p>
                {[
                  { value: "discord", label: "Discord만 삭제", desc: "Discord 채널 메시지만 삭제, 웹 기록은 유지" },
                  { value: "web",     label: "웹만 삭제",      desc: "웹 DB에서만 삭제, Discord 메시지는 유지" },
                  { value: "both",    label: "웹 + Discord 동시 삭제", desc: "" },
                ].map(opt => (
                  <label key={opt.value}
                    className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="cleanupMode"
                      value={opt.value}
                      checked={cleanupMode === opt.value}
                      onChange={() => setCleanupMode(opt.value)}
                      className="mt-0.5 accent-purple-600 flex-shrink-0"
                    />
                    <div>
                      <span className={`text-sm ${d ? "text-gray-200" : "text-gray-700"}`}>{opt.label}</span>
                      {opt.desc && (
                        <p className={`text-xs mt-0.5 ${d ? "text-gray-500" : "text-gray-400"}`}>{opt.desc}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* 삭제 실행 버튼 */}
              <Button
                disabled={cleanupChecked.size === 0 || cleanupLoading}
                onClick={handleCleanupDelete}
                className={`w-full py-2.5 text-sm font-bold bg-red-500 hover:bg-red-400 text-white
                  ${cleanupChecked.size === 0 || cleanupLoading ? "opacity-50 cursor-not-allowed" : ""}`}>
                {cleanupLoading
                  ? <span className="flex items-center gap-2"><RefreshCw size={13} className="animate-spin" />삭제 중...</span>
                  : <span className="flex items-center gap-2"><Trash2 size={13} />삭제 실행 ({cleanupChecked.size}개)</span>
                }
              </Button>

              <button onClick={resetCleanup}
                className={`text-xs ${d ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}>
                취소
              </button>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
