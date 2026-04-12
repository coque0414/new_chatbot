"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronDown, Users, Clock, Calendar, Hash, Zap } from "lucide-react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { getTheme } from "@/lib/themes"
import { TRAIN_PRESETS } from "@/lib/trainData"
import { SUPPORTER_CLASSES, getMinLevel } from "@/lib/lostarkData"

const RAIDS = [
  {
    category: "카제로스 레이드",
    raids: [
      {
        name: "붉어진 백야의 나선",
        alias: "에키드나",
        tag: "서막",
        maxPlayers: 8,
        difficulties: [
          { name: "노말", level: 1620 },
          { name: "하드", level: 1640 },
        ]
      },
      {
        name: "대지를 부수는 업화의 궤적",
        alias: "에기르",
        tag: "1막",
        maxPlayers: 8,
        difficulties: [
          { name: "노말", level: 1660 },
          { name: "하드", level: 1680 },
        ]
      },
      {
        name: "부유하는 악몽의 진혼곡",
        alias: "아브렐슈드",
        tag: "2막",
        maxPlayers: 8,
        difficulties: [
          { name: "노말", level: 1670 },
          { name: "하드", level: 1690 },
        ]
      },
      {
        name: "칠흑, 폭풍의 밤",
        alias: "모르둠",
        tag: "3막",
        maxPlayers: 8,
        difficulties: [
          { name: "노말", level: 1680 },
          { name: "하드", level: 1700 },
        ]
      },
      {
        name: "파멸의 성채",
        alias: "아르모체",
        tag: "4막",
        maxPlayers: 8,
        difficulties: [
          { name: "노말", level: 1700 },
          { name: "하드", level: 1720 },
        ]
      },
      {
        name: "최후의 날",
        alias: "카제로스",
        tag: "종막",
        maxPlayers: 8,
        difficulties: [
          { name: "노말", level: 1710 },
          { name: "하드", level: 1730 },
        ]
      },
    ]
  },
  {
    category: "그림자 레이드",
    raids: [
      {
        name: "세르카",
        alias: "세르카",
        tag: "그림자",
        maxPlayers: 4,
        difficulties: [
          { name: "노말", level: 1710 },
          { name: "하드", level: 1730 },
          { name: "나이트메어", level: 1740 },
        ]
      },
    ]
  },
  {
    category: "어비스 던전",
    raids: [
      {
        name: "아르세노스",
        alias: "지평의 성당",
        tag: "성당",
        maxPlayers: 4,
        difficulties: [
          { name: "1단계", level: 1700 },
          { name: "2단계", level: 1720 },
          { name: "3단계", level: 1750 },
        ]
      },
    ]
  },
]

export default function RaidCreatePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [themeId, setThemeId] = useState("dark")
  const [mounted, setMounted] = useState(false)

  // 탭
  const [activeTab, setActiveTab] = useState("single")

  // 단일 레이드 폼 상태
  const [selectedRaid, setSelectedRaid] = useState(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [isMobaChul, setIsMobaChul] = useState(false)
  const [raidDropdownOpen, setRaidDropdownOpen] = useState(false)
  const [hostRole, setHostRole] = useState("dealer")

  // 알림 설정
  const [notifyMinutes, setNotifyMinutes] = useState(30)
  const [trainNotifyMinutes, setTrainNotifyMinutes] = useState(30)

  // N종 기차 폼 상태
  const [trainLevel, setTrainLevel] = useState(null)       // 선택된 배럭 레벨 (1680 등)
  const [trainOption, setTrainOption] = useState(null)     // 선택된 기차 구성 option 객체
  const [trainMaxPlayers, setTrainMaxPlayers] = useState(8)
  const [trainIsMobaChul, setTrainIsMobaChul] = useState(false)
  const [trainDate, setTrainDate] = useState("")
  const [trainTime, setTrainTime] = useState("")
  const [trainHostRole, setTrainHostRole] = useState("dealer")

  // 캐릭터 선택
  const [myCharacters, setMyCharacters] = useState([])
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [trainSelectedCharacter, setTrainSelectedCharacter] = useState(null)
  const [loadingCharacters, setLoadingCharacters] = useState(false)

  // 공통 상태
  const [guilds, setGuilds] = useState([])
  const [loadingGuilds, setLoadingGuilds] = useState(false)
  const [selectedGuild, setSelectedGuild] = useState(null)
  const [guildSettings, setGuildSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // 탭 전환 (폼 상태 초기화)
  const handleTabChange = (tab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    setSubmitError(null)
    setSelectedCharacter(null)
    setTrainSelectedCharacter(null)
    if (tab === "train") {
      setSelectedRaid(null)
      setSelectedDifficulty("")
      setDate(""); setTime("")
      setIsMobaChul(false)
      setRaidDropdownOpen(false)
    } else {
      setTrainLevel(null)
      setTrainOption(null)
      setTrainMaxPlayers(8)
      setTrainIsMobaChul(false)
      setTrainDate(""); setTrainTime("")
      setTrainHostRole("dealer")
    }
  }

  useEffect(() => {
    const handleClickOutside = () => setRaidDropdownOpen(false)
    if (raidDropdownOpen) {
      document.addEventListener("click", handleClickOutside)
    }
    return () => document.removeEventListener("click", handleClickOutside)
  }, [raidDropdownOpen])

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

      setLoadingCharacters(true)
      fetch("/api/characters")
        .then(r => r.json())
        .then(data => setMyCharacters(data.characters || []))
        .catch(() => {})
        .finally(() => setLoadingCharacters(false))
    }
  }, [status])

  // 서버 선택 시 공고 채널 설정 조회
  const handleGuildSelect = async (guild) => {
    setSelectedGuild(guild)
    setGuildSettings(null)
    setLoadingSettings(true)
    try {
      const res = await fetch(`/api/discord/guild-settings?guildId=${guild.id}`)
      const data = await res.json()
      setGuildSettings(data.settings || {})
    } catch (e) {
      setGuildSettings({})
    } finally {
      setLoadingSettings(false)
    }
  }

  // 레이드 선택 시 난이도 초기화
  const handleRaidSelect = (raid) => {
    setSelectedRaid(raid)
    setSelectedDifficulty("")
    setRaidDropdownOpen(false)
  }

  const announcementChannelId = guildSettings?.announcementChannelId || null
  const announcementChannelName = guildSettings?.announcementChannelName || null

  // 주최자가 딜러/서포터인데 캐릭터 미선택이면 유효하지 않음
  const hostNeedsCharacter = hostRole !== "none"
  const hostCharacterValid = !hostNeedsCharacter || selectedCharacter !== null

  const isFormValid = selectedRaid && selectedDifficulty
    && selectedGuild && announcementChannelId
    && (isMobaChul || (date && time))
    && hostCharacterValid

  const trainHostNeedsCharacter = trainHostRole !== "none"
  const trainHostCharacterValid = !trainHostNeedsCharacter || trainSelectedCharacter !== null

  const isTrainFormValid =
    trainLevel !== null && trainOption !== null &&
    selectedGuild && announcementChannelId &&
    (trainIsMobaChul || (trainDate && trainTime)) &&
    trainHostCharacterValid

  // 기차 레벨 선택 시 maxPlayers 초기화
  const handleTrainLevelSelect = (level) => {
    setTrainLevel(level)
    setTrainOption(null)
    if (TRAIN_PRESETS[level].maxPlayers) {
      setTrainMaxPlayers(TRAIN_PRESETS[level].maxPlayers)
    } else {
      setTrainMaxPlayers(8)
    }
  }

  if (!mounted || status === "loading") return null
  if (!session) return null

  const theme = getTheme(themeId)
  const d = theme.isDark

  // 단일 레이드: 역할·레이드·난이도 기준 필터링
  const filteredSingleChars = (() => {
    if (!myCharacters.length) return []
    const minLevel = selectedRaid && selectedDifficulty ? getMinLevel(selectedRaid.alias, selectedDifficulty) : 0
    let chars = minLevel > 0 ? myCharacters.filter(c => c.level >= minLevel) : [...myCharacters]
    if (hostRole === "support") chars = chars.filter(c => SUPPORTER_CLASSES.includes(c.class))
    return chars.sort((a, b) => b.level - a.level)
  })()

  // 기차: 구성 내 최고 최소레벨 기준 필터링
  const filteredTrainChars = (() => {
    if (!myCharacters.length || !trainOption) return []
    const maxMinLevel = trainOption.raids.reduce((max, r) => {
      const lv = getMinLevel(r.alias || r.raidAlias, r.difficulty)
      return lv > max ? lv : max
    }, 0)
    let chars = maxMinLevel > 0 ? myCharacters.filter(c => c.level >= maxMinLevel) : [...myCharacters]
    if (trainHostRole === "support") chars = chars.filter(c => SUPPORTER_CLASSES.includes(c.class))
    return chars.sort((a, b) => b.level - a.level)
  })()

  const inputClass = `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors
    ${d
      ? "bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50"
      : "bg-white border-purple-100 text-gray-800 placeholder-gray-400 focus:border-purple-300"
    }`

  // --- 공유 섹션 렌더 헬퍼 ---

  const renderMobaChul = (isMoba, setIsMoba, clearDateTime) => (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border
      ${d ? "bg-white/5 border-white/10" : "bg-purple-50 border-purple-100"}`}>
      <div className="flex items-center gap-3">
        <Zap size={16} className={d ? "text-amber-400" : "text-purple-500"} />
        <div>
          <p className={`text-sm font-medium ${d ? "text-white" : "text-gray-800"}`}>모바출</p>
          <p className={`text-xs ${d ? "text-gray-500" : "text-gray-400"}`}>인원이 다 차면 바로 출발</p>
        </div>
      </div>
      <button
        onClick={() => { const next = !isMoba; setIsMoba(next); if (next) clearDateTime() }}
        style={{ flexShrink: 0 }}
        className={`relative inline-flex w-11 h-6 rounded-full transition-colors
          ${isMoba ? d ? "bg-amber-500" : "bg-purple-600" : d ? "bg-white/20" : "bg-gray-200"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200
          ${isMoba ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  )

  const renderDateTime = (isMoba, dtDate, setDtDate, dtTime, setDtTime) => (
    <div className={`grid grid-cols-2 gap-4 transition-opacity duration-200 ${isMoba ? "opacity-40 pointer-events-none select-none" : ""}`}>
      <div>
        <label className={`block text-sm font-medium mb-2 ${d ? "text-gray-300" : "text-gray-700"}`}>
          <Calendar size={14} className="inline mr-1" />날짜{isMoba ? "" : " *"}
        </label>
        <input type="date" value={dtDate} onChange={e => setDtDate(e.target.value)}
          disabled={isMoba}
          className={`${inputClass} ${isMoba ? "cursor-not-allowed" : ""}`} />
      </div>
      <div>
        <label className={`block text-sm font-medium mb-2 ${d ? "text-gray-300" : "text-gray-700"}`}>
          <Clock size={14} className="inline mr-1" />시간{isMoba ? "" : " *"}
        </label>
        <input type="time" value={dtTime} onChange={e => setDtTime(e.target.value)}
          disabled={isMoba}
          className={`${inputClass} ${isMoba ? "cursor-not-allowed" : ""}`} />
      </div>
      {isMoba && (
        <p className={`col-span-2 text-xs -mt-1 ${d ? "text-amber-400/60" : "text-purple-400"}`}>
          ⚡ 모바출 활성화 시 날짜/시간 설정 불필요
        </p>
      )}
    </div>
  )

  const renderHostRole = (role, setRole, radioName, filteredChars, selectedChar, setSelectedChar) => (
    <div className={`px-4 py-4 rounded-xl border ${d ? "bg-white/5 border-white/10" : "bg-purple-50 border-purple-100"}`}>
      <p className={`text-sm font-medium mb-3 ${d ? "text-white" : "text-gray-800"}`}>
        👑 주최자 참가 여부
      </p>
      <div className="flex gap-3">
        {[
          { value: "dealer", label: "⚔️ 딜러" },
          { value: "support", label: "🛡️ 서포터" },
          { value: "none", label: "🚫 미참여" },
        ].map((opt) => (
          <label key={opt.value}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm cursor-pointer transition-colors
              ${role === opt.value
                ? d ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-purple-600 border-purple-600 text-white"
                : d ? "bg-white/5 border-white/10 text-gray-400 hover:border-white/20" : "bg-white border-purple-100 text-gray-500 hover:border-purple-300"
              }`}>
            <input
              type="radio"
              name={radioName}
              value={opt.value}
              checked={role === opt.value}
              onChange={() => { setRole(opt.value); setSelectedChar(null) }}
              className="hidden"
            />
            {opt.label}
          </label>
        ))}
      </div>

      {role !== "none" && (
        <div className="mt-3">
          {loadingCharacters ? (
            <p className={`text-xs ${d ? "text-gray-500" : "text-gray-400"}`}>캐릭터 불러오는 중...</p>
          ) : myCharacters.length === 0 ? (
            <div className="space-y-2">
              <p className={`text-xs ${d ? "text-red-400" : "text-red-500"}`}>
                ⚠️ 레이드에 참가하려면 캐릭터 연동이 필요합니다.
              </p>
              <a href="/characters">
                <Button size="sm" className={`text-xs h-7 ${d ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30" : "bg-purple-100 text-purple-600 border border-purple-200 hover:bg-purple-200"}`}>
                  캐릭터 연동하기
                </Button>
              </a>
            </div>
          ) : (
            <>
              <select
                value={selectedChar?.name || ""}
                onChange={e => {
                  const char = filteredChars.find(c => c.name === e.target.value)
                  setSelectedChar(char || null)
                }}
                className={inputClass}>
                <option value="">캐릭터를 선택하세요 *</option>
                {filteredChars.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.class}) Lv.{c.level}
                  </option>
                ))}
              </select>
              {selectedChar === null && (
                <p className={`text-xs mt-1.5 ${d ? "text-red-400" : "text-red-500"}`}>
                  ⚠️ 참가할 캐릭터를 선택해주세요
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )

  const renderGuildSelector = () => (
    <div>
      <label className={`block text-sm font-medium mb-2 ${d ? "text-gray-300" : "text-gray-700"}`}>
        <Hash size={14} className="inline mr-1" />Discord 서버 *
      </label>
      <select
        value={selectedGuild?.id || ""}
        onChange={e => {
          const guild = guilds.find(g => g.id === e.target.value)
          if (guild) handleGuildSelect(guild)
          else { setSelectedGuild(null); setGuildSettings(null) }
        }}
        className={inputClass}>
        <option value="">서버를 선택하세요</option>
        {guilds.map(guild => (
          <option key={guild.id} value={guild.id}>{guild.name}</option>
        ))}
      </select>

      {selectedGuild && (
        <div className={`mt-2 px-4 py-3 rounded-xl border text-sm
          ${loadingSettings
            ? d ? "border-white/10 text-gray-500" : "border-purple-100 text-gray-400"
            : announcementChannelId
              ? d ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-700"
              : d ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-amber-200 bg-amber-50 text-amber-700"
          }`}>
          {loadingSettings
            ? "공고 채널 정보 불러오는 중..."
            : announcementChannelId
              ? `📢 공고 채널: #${announcementChannelName || announcementChannelId}`
              : <span>⚠️ 봇 설정에서 공고 채널을 먼저 지정해주세요.{" "}
                  <a href="/bot-settings" className="underline font-medium">봇 설정으로 이동</a>
                </span>
          }
        </div>
      )}
    </div>
  )

  return (
    <DashboardLayout themeId={themeId} setThemeId={setThemeId} session={session} activeNav="raid-create">
      <div className="max-w-2xl">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <a href="/dashboard"
            className={`p-2 rounded-xl transition-colors ${d ? "hover:bg-white/10" : "hover:bg-purple-100"}`}>
            <ChevronLeft size={18} />
          </a>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-cinzel), serif" }}>
              레이드 예약 생성
            </h1>
            <p className={`text-sm mt-0.5 ${d ? "text-gray-400" : "text-gray-500"}`}>
              레이드 정보를 입력하고 Discord에 공지하세요
            </p>
          </div>
        </div>

        {/* 탭 */}
        <div className={`flex gap-1 p-1 rounded-xl mb-4 ${d ? "bg-white/5" : "bg-purple-50"}`}>
          {[
            { key: "single", label: "단일 레이드" },
            { key: "train", label: "N종 기차" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === tab.key
                  ? d
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-white text-purple-700 shadow-sm border border-purple-100"
                  : d ? "text-gray-500 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"
                }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <Card className={`border p-6 space-y-6 ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>

          {/* ===== 단일 레이드 탭 ===== */}
          {activeTab === "single" && (
            <>
              {/* 레이드 선택 */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${d ? "text-gray-300" : "text-gray-700"}`}>
                  레이드 선택 *
                </label>
                <div className="relative">
                  <button
                    onClick={() => setRaidDropdownOpen(!raidDropdownOpen)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors
                      ${d ? "bg-white/5 border-white/10 hover:border-white/20" : "bg-white border-purple-100 hover:border-purple-300"}
                      ${!selectedRaid ? (d ? "text-gray-500" : "text-gray-400") : ""}`}>
                    {selectedRaid ? (
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${d ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-purple-100 text-purple-600 border-purple-200"}`}>
                          {selectedRaid.tag}
                        </Badge>
                        <span className={d ? "text-white" : "text-gray-800"}>{selectedRaid.alias}</span>
                        <span className={`text-xs ${d ? "text-gray-400" : "text-gray-400"}`}>({selectedRaid.name})</span>
                      </div>
                    ) : "레이드를 선택하세요"}
                    <ChevronDown size={16} className={raidDropdownOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                  </button>

                  {raidDropdownOpen && (
                    <div className={`absolute top-full left-0 right-0 mt-1 border rounded-xl overflow-hidden z-50 shadow-lg
                      ${d ? "bg-[#1a1d26] border-white/10" : "bg-white border-purple-100"}`}>
                      {RAIDS.map((cat) => (
                        <div key={cat.category}>
                          <div className={`px-4 py-2 text-xs font-medium tracking-wider uppercase
                            ${d ? "text-gray-500 bg-white/5" : "text-gray-400 bg-purple-50"}`}>
                            {cat.category}
                          </div>
                          {cat.raids.map((raid) => (
                            <button key={raid.name}
                              onClick={() => handleRaidSelect(raid)}
                              className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors
                                ${d ? "hover:bg-white/5 text-gray-300" : "hover:bg-purple-50 text-gray-700"}`}>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${d ? "bg-white/5 text-gray-400 border-white/10" : "bg-purple-50 text-purple-400 border-purple-100"}`}>
                                  {raid.tag}
                                </Badge>
                                <span className="font-medium">{raid.alias}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs ${d ? "text-gray-500" : "text-gray-400"}`}>
                                  {raid.difficulties[0].level}~{raid.difficulties[raid.difficulties.length-1].level}+
                                </span>
                                <span className={`text-xs flex items-center gap-1 ${d ? "text-gray-500" : "text-gray-400"}`}>
                                  <Users size={11} />{raid.maxPlayers}인
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 선택된 레이드 정보 */}
                {selectedRaid && (
                  <div className={`mt-2 flex items-center gap-3 px-3 py-2 rounded-lg text-xs
                    ${d ? "bg-amber-500/5 text-amber-400/80" : "bg-purple-50 text-purple-500"}`}>
                    <Users size={12} />
                    <span>최대 {selectedRaid.maxPlayers}인 레이드</span>
                    <span>·</span>
                    <span>
                      입장 레벨{" "}
                      {selectedDifficulty
                        ? selectedRaid.difficulties.find(d => d.name === selectedDifficulty)?.level + "+"
                        : `${selectedRaid.difficulties[0].level}~${selectedRaid.difficulties[selectedRaid.difficulties.length-1].level}+`
                      }
                    </span>
                  </div>
                )}
              </div>

              {/* 난이도 선택 */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${d ? "text-gray-300" : "text-gray-700"}`}>
                  난이도 *
                </label>
                <div className="flex gap-2">
                  {selectedRaid ? selectedRaid.difficulties.map((diff) => (
                    <div key={diff.name}
                      onClick={() => setSelectedDifficulty(diff.name)}
                      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer text-center
                        ${selectedDifficulty === diff.name
                          ? d ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-purple-600 border-purple-600 text-white"
                          : d ? "bg-white/5 border-white/10 text-gray-400 hover:border-white/20" : "bg-white border-purple-100 text-gray-500 hover:border-purple-300"
                        }`}>
                      <div>{diff.name}</div>
                      <div className={`text-xs mt-0.5 ${selectedDifficulty === diff.name ? "opacity-80" : "opacity-50"}`}>
                        {diff.level}+
                      </div>
                    </div>
                  )) : (
                    <div className={`flex-1 py-3 rounded-xl border text-sm text-center
                      ${d ? "border-white/5 text-gray-600" : "border-purple-50 text-gray-300"}`}>
                      레이드를 먼저 선택하세요
                    </div>
                  )}
                </div>
              </div>

              {/* 모바출 토글 */}
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border
                ${d ? "bg-white/5 border-white/10" : "bg-purple-50 border-purple-100"}`}>
                <div className="flex items-center gap-3">
                  <Zap size={16} className={d ? "text-amber-400" : "text-purple-500"} />
                  <div>
                    <p className={`text-sm font-medium ${d ? "text-white" : "text-gray-800"}`}>모바출</p>
                    <p className={`text-xs ${d ? "text-gray-500" : "text-gray-400"}`}>인원이 다 차면 바로 출발</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = !isMobaChul
                    setIsMobaChul(next)
                    if (next) { setDate(""); setTime("") }
                  }}
                  style={{ flexShrink: 0 }}
                  className={`relative inline-flex w-11 h-6 rounded-full transition-colors
                    ${isMobaChul
                      ? d ? "bg-amber-500" : "bg-purple-600"
                      : d ? "bg-white/20" : "bg-gray-200"
                    }`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200
                    ${isMobaChul ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {/* DM 알림 */}
              <div className={`transition-opacity duration-200
                ${isMobaChul ? "opacity-40 pointer-events-none select-none" : ""}`}>
                <label className={`block text-sm font-medium mb-2
                  ${d ? "text-gray-300" : "text-gray-700"}`}>
                  <Clock size={14} className="inline mr-1" />
                  레이드 시작 전 DM 알림
                  {isMobaChul && (
                    <span className={`ml-2 text-xs font-normal
                      ${d ? "text-gray-500" : "text-gray-400"}`}>
                      (모바출 시 비활성)
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  {[10, 20, 30].map(min => (
                    <button
                      key={min}
                      disabled={isMobaChul}
                      onClick={() => setNotifyMinutes(min)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors
                        ${isMobaChul ? "cursor-not-allowed" : ""}
                        ${notifyMinutes === min
                          ? d
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                            : "bg-purple-600 border-purple-600 text-white"
                          : d
                            ? "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                            : "bg-white border-purple-100 text-gray-500 hover:border-purple-300"
                        }`}>
                      {min}분 전
                    </button>
                  ))}
                </div>
              </div>

              {/* 날짜 & 시간 */}
              <div className={`grid grid-cols-2 gap-4 transition-opacity duration-200 ${isMobaChul ? "opacity-40 pointer-events-none select-none" : ""}`}>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${d ? "text-gray-300" : "text-gray-700"}`}>
                    <Calendar size={14} className="inline mr-1" />날짜{isMobaChul ? "" : " *"}
                  </label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    disabled={isMobaChul}
                    className={`${inputClass} ${isMobaChul ? "cursor-not-allowed" : ""}`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${d ? "text-gray-300" : "text-gray-700"}`}>
                    <Clock size={14} className="inline mr-1" />시간{isMobaChul ? "" : " *"}
                  </label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    disabled={isMobaChul}
                    className={`${inputClass} ${isMobaChul ? "cursor-not-allowed" : ""}`} />
                </div>
                {isMobaChul && (
                  <p className={`col-span-2 text-xs -mt-1 ${d ? "text-amber-400/60" : "text-purple-400"}`}>
                    ⚡ 모바출 활성화 시 날짜/시간 설정 불필요
                  </p>
                )}
              </div>

              {/* 주최자 참가 여부 */}
              {renderHostRole(hostRole, setHostRole, "hostRole", filteredSingleChars, selectedCharacter, setSelectedCharacter)}

              {/* Discord 서버 선택 */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${d ? "text-gray-300" : "text-gray-700"}`}>
                  <Hash size={14} className="inline mr-1" />Discord 서버 *
                </label>
                <select
                  value={selectedGuild?.id || ""}
                  onChange={e => {
                    const guild = guilds.find(g => g.id === e.target.value)
                    if (guild) handleGuildSelect(guild)
                    else { setSelectedGuild(null); setGuildSettings(null) }
                  }}
                  className={inputClass}>
                  <option value="">서버를 선택하세요</option>
                  {guilds.map(guild => (
                    <option key={guild.id} value={guild.id}>{guild.name}</option>
                  ))}
                </select>

                {/* 공고 채널 표시 */}
                {selectedGuild && (
                  <div className={`mt-2 px-4 py-3 rounded-xl border text-sm
                    ${loadingSettings
                      ? d ? "border-white/10 text-gray-500" : "border-purple-100 text-gray-400"
                      : announcementChannelId
                        ? d ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : d ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}>
                    {loadingSettings
                      ? "공고 채널 정보 불러오는 중..."
                      : announcementChannelId
                        ? `📢 공고 채널: #${announcementChannelName || announcementChannelId}`
                        : <span>⚠️ 봇 설정에서 공고 채널을 먼저 지정해주세요.{" "}
                            <a href="/bot-settings" className="underline font-medium">봇 설정으로 이동</a>
                          </span>
                    }
                  </div>
                )}
              </div>

              {/* 에러 메시지 */}
              {submitError && (
                <p className="text-red-400 text-xs text-center">{submitError}</p>
              )}

              {/* 제출 버튼 */}
              <div className="flex gap-3 pt-2">
                <a href="/dashboard" className="flex-1">
                  <Button variant="outline" className={`w-full py-3
                    ${d ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-purple-100 text-gray-500 hover:bg-purple-50"}`}>
                    취소
                  </Button>
                </a>
                <Button
                  disabled={!isFormValid || submitting}
                  className={`flex-1 py-3 font-bold transition-all
                    ${isFormValid && !submitting
                      ? d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"
                      : "opacity-40 cursor-not-allowed bg-gray-500 text-white"
                    }`}
                  onClick={async () => {
                    setSubmitting(true)
                    setSubmitError(null)
                    try {
                      const res = await fetch("/api/raids", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          raidName: selectedRaid.name,
                          raidAlias: selectedRaid.alias,
                          raidTag: selectedRaid.tag,
                          difficulty: selectedDifficulty,
                          maxPlayers: selectedRaid.maxPlayers,
                          date,
                          time,
                          isMobaChul,
                          discordChannelId: announcementChannelId,
                          guildId: selectedGuild?.id,
                          hostRole,
                          hostCharacter: selectedCharacter ? {
                            name: selectedCharacter.name,
                            class: selectedCharacter.class,
                            level: selectedCharacter.level,
                            combatPower: selectedCharacter.combatPower || null,
                          } : null,
                          notifyMinutesBefore: notifyMinutes,
                        }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        router.push(`/raids/${data.raid._id}`)
                      } else {
                        setSubmitError(data.error)
                      }
                    } catch (e) {
                      setSubmitError(e.message)
                    } finally {
                      setSubmitting(false)
                    }
                  }}>
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      생성 중...
                    </span>
                  ) : "레이드 예약 생성"}
                </Button>
              </div>
            </>
          )}

          {/* ===== N종 기차 탭 ===== */}
          {activeTab === "train" && (
            <>
              {/* Step 1: 배럭 레벨 선택 */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${d ? "text-gray-300" : "text-gray-700"}`}>
                  Step 1. 배럭 레벨 선택 *
                </label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(TRAIN_PRESETS).map(([level, preset]) => (
                    <button
                      key={level}
                      onClick={() => handleTrainLevelSelect(Number(level))}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors
                        ${trainLevel === Number(level)
                          ? d ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-purple-600 border-purple-600 text-white"
                          : d ? "bg-white/5 border-white/10 text-gray-400 hover:border-white/20" : "bg-white border-purple-100 text-gray-500 hover:border-purple-300"
                        }`}>
                      {level}
                    </button>
                  ))}
                </div>
                {trainLevel && (
                  <p className={`mt-2 text-xs ${d ? "text-amber-400/70" : "text-purple-500"}`}>
                    {TRAIN_PRESETS[trainLevel].label}
                  </p>
                )}
              </div>

              {/* Step 2: 파티 인원 선택 */}
              {trainLevel && (
                <div>
                  <label className={`block text-sm font-medium mb-3 ${d ? "text-gray-300" : "text-gray-700"}`}>
                    <Users size={14} className="inline mr-1" />Step 2. 파티 인원 *
                  </label>
                  {TRAIN_PRESETS[trainLevel].maxPlayers ? (
                    <div className={`px-4 py-3 rounded-xl border text-sm
                      ${d ? "bg-white/5 border-white/10 text-gray-300" : "bg-purple-50 border-purple-100 text-gray-600"}`}>
                      8인 고정
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      {TRAIN_PRESETS[trainLevel].maxPlayersOptions.map(n => (
                        <button key={n}
                          onClick={() => setTrainMaxPlayers(n)}
                          className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors
                            ${trainMaxPlayers === n
                              ? d ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-purple-600 border-purple-600 text-white"
                              : d ? "bg-white/5 border-white/10 text-gray-400 hover:border-white/20" : "bg-white border-purple-100 text-gray-500 hover:border-purple-300"
                            }`}>
                          {n}인
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: 기차 구성 선택 */}
              {trainLevel && (
                <div>
                  <label className={`block text-sm font-medium mb-3 ${d ? "text-gray-300" : "text-gray-700"}`}>
                    Step 3. 기차 구성 선택 *
                  </label>
                  <div className="space-y-3">
                    {TRAIN_PRESETS[trainLevel].options.map(opt => (
                      <div
                        key={opt.id}
                        onClick={() => setTrainOption(opt)}
                        className={`p-4 rounded-xl border cursor-pointer transition-colors
                          ${trainOption?.id === opt.id
                            ? d ? "bg-amber-500/10 border-amber-500/50" : "bg-purple-50 border-purple-400"
                            : d ? "bg-white/5 border-white/10 hover:border-white/20" : "bg-white border-purple-100 hover:border-purple-300"
                          }`}>
                        <p className={`text-sm font-semibold mb-2
                          ${trainOption?.id === opt.id
                            ? d ? "text-amber-400" : "text-purple-700"
                            : d ? "text-gray-200" : "text-gray-800"
                          }`}>
                          {opt.label}
                        </p>
                        <div className="space-y-1">
                          {opt.raids.map((r, i) => (
                            <p key={i} className={`text-xs ${d ? "text-gray-400" : "text-gray-500"}`}>
                              {i + 1}. ({r.tag}) {r.alias} {r.difficulty} · {r.maxPlayers}인
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 레이드 구성 미리보기 */}
              {trainLevel && trainOption && (
                <div className={`p-4 rounded-xl border ${d ? "bg-white/[0.02] border-white/10" : "bg-purple-50/60 border-purple-100"}`}>
                  <p className={`text-sm font-semibold mb-2 ${d ? "text-amber-400" : "text-purple-700"}`}>
                    📋 {TRAIN_PRESETS[trainLevel].label} 기차 ({trainMaxPlayers}인)
                  </p>
                  <p className={`text-xs mb-3 ${d ? "text-gray-500" : "text-gray-400"}`}>
                    딜러 {trainMaxPlayers - trainMaxPlayers / 4}명 / 서포터 {trainMaxPlayers / 4}명 모집
                  </p>
                  <div className="space-y-1">
                    {trainOption.raids.map((r, i) => (
                      <p key={i} className={`text-xs ${d ? "text-gray-300" : "text-gray-600"}`}>
                        {i + 1}. ({r.tag}) {r.alias} {r.difficulty}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: 공통 설정 (레벨·구성 선택 후 표시) */}
              {trainLevel && trainOption && (
                <>
                  {/* 모바출 */}
                  {renderMobaChul(trainIsMobaChul, setTrainIsMobaChul, () => { setTrainDate(""); setTrainTime("") })}

                  {/* DM 알림 */}
                  <div className={`transition-opacity duration-200
                    ${trainIsMobaChul ? "opacity-40 pointer-events-none select-none" : ""}`}>
                    <label className={`block text-sm font-medium mb-2
                      ${d ? "text-gray-300" : "text-gray-700"}`}>
                      <Clock size={14} className="inline mr-1" />
                      레이드 시작 전 DM 알림
                      {trainIsMobaChul && (
                        <span className={`ml-2 text-xs font-normal
                          ${d ? "text-gray-500" : "text-gray-400"}`}>
                          (모바출 시 비활성)
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      {[10, 20, 30].map(min => (
                        <button
                          key={min}
                          disabled={trainIsMobaChul}
                          onClick={() => setTrainNotifyMinutes(min)}
                          className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors
                            ${trainIsMobaChul ? "cursor-not-allowed" : ""}
                            ${trainNotifyMinutes === min
                              ? d
                                ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                                : "bg-purple-600 border-purple-600 text-white"
                              : d
                                ? "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                                : "bg-white border-purple-100 text-gray-500 hover:border-purple-300"
                            }`}>
                          {min}분 전
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 날짜/시간 */}
                  {renderDateTime(trainIsMobaChul, trainDate, setTrainDate, trainTime, setTrainTime)}

                  {/* 주최자 참가 여부 */}
                  {renderHostRole(trainHostRole, setTrainHostRole, "trainHostRole", filteredTrainChars, trainSelectedCharacter, setTrainSelectedCharacter)}

                  {/* Discord 서버 선택 */}
                  {renderGuildSelector()}
                </>
              )}

              {/* 에러 메시지 */}
              {submitError && (
                <p className="text-red-400 text-xs text-center">{submitError}</p>
              )}

              {/* 제출 버튼 */}
              <div className="flex gap-3 pt-2">
                <a href="/dashboard" className="flex-1">
                  <Button variant="outline" className={`w-full py-3
                    ${d ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-purple-100 text-gray-500 hover:bg-purple-50"}`}>
                    취소
                  </Button>
                </a>
                <Button
                  disabled={!isTrainFormValid || submitting}
                  className={`flex-1 py-3 font-bold transition-all
                    ${isTrainFormValid && !submitting
                      ? d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"
                      : "opacity-40 cursor-not-allowed bg-gray-500 text-white"
                    }`}
                  onClick={async () => {
                    if (!trainOption || !trainLevel) return
                    setSubmitting(true)
                    setSubmitError(null)
                    try {
                      const res = await fetch("/api/train-raids", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          trainKey: trainOption.id,
                          maxPlayers: trainMaxPlayers,
                          isMobaChul: trainIsMobaChul,
                          date: trainDate,
                          time: trainTime,
                          discordChannelId: announcementChannelId,
                          guildId: selectedGuild?.id,
                          hostRole: trainHostRole,
                          hostCharacter: trainSelectedCharacter ? {
                            name: trainSelectedCharacter.name,
                            class: trainSelectedCharacter.class,
                            level: trainSelectedCharacter.level,
                            combatPower: trainSelectedCharacter.combatPower || null,
                          } : null,
                          notifyMinutesBefore: trainNotifyMinutes,
                        }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        router.push(`/train-raids/${data.trainRaid._id}`)
                      } else {
                        setSubmitError(data.error)
                      }
                    } catch (e) {
                      setSubmitError(e.message)
                    } finally {
                      setSubmitting(false)
                    }
                  }}>
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      생성 중...
                    </span>
                  ) : trainOption ? `${trainOption.raids.length}종 기차 생성` : "기차 생성"}
                </Button>
              </div>
            </>
          )}

        </Card>
      </div>
    </DashboardLayout>
  )
}
