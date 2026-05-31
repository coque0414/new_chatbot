"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, X, Shield } from "lucide-react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { getTheme } from "@/lib/themes"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SUPPORTER_CLASSES } from "@/lib/lostarkData"

const WEEKDAYS = ["수", "목", "금", "토", "일", "월", "화"]
const SKILL_CHOICES = ["헤딩", "트라이", "클경", "반숙", "숙련", "숙제"]

const RAID_LIST = [
  { key: "ekidna",    raidAlias: "에키드나",   raidName: "붉어진 백야의 나선",       raidTag: "서막",    maxPlayers: 8,  difficulties: ["노말", "하드"] },
  { key: "aegir",     raidAlias: "에기르",     raidName: "대지를 부수는 업화의 궤적", raidTag: "1막",    maxPlayers: 8,  difficulties: ["노말", "하드"] },
  { key: "abrelshud", raidAlias: "아브렐슈드", raidName: "부유하는 악몽의 진혼곡",    raidTag: "2막",    maxPlayers: 8,  difficulties: ["노말", "하드", "익스트림 노말", "익스트림 하드", "나이트메어"] },
  { key: "mordoom",   raidAlias: "모르둠",     raidName: "칠흑, 폭풍의 밤",          raidTag: "3막",    maxPlayers: 8,  difficulties: ["노말", "하드"] },
  { key: "armoche",   raidAlias: "아르모체",   raidName: "파멸의 성채",              raidTag: "4막",    maxPlayers: 8,  difficulties: ["노말", "하드"] },
  { key: "kazeros",   raidAlias: "카제로스",   raidName: "최후의 날",               raidTag: "종막",   maxPlayers: 8,  difficulties: ["노말", "하드"] },
  { key: "serka",     raidAlias: "세르카",     raidName: "세르카",                  raidTag: "그림자", maxPlayers: 4,  difficulties: ["노말", "하드", "나이트메어"] },
  { key: "arsenous",  raidAlias: "지평의 성당", raidName: "아르세노스",              raidTag: "성당",   maxPlayers: 4,  difficulties: ["1단계", "2단계", "3단계"] },
]

const EMPTY_FORM = {
  weekday: 0, time: "", raidKey: "", difficulty: "", difficulty_level: "", maxPlayers: 8,
}

function getWeekDates() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const day = kst.getUTCDay()
  const diffToWed = day >= 3 ? day - 3 : day + 4
  const wed = new Date(kst)
  wed.setUTCDate(kst.getUTCDate() - diffToWed)
  const todayStr = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(wed)
    d.setUTCDate(wed.getUTCDate() + i)
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
    return {
      weekday: i,
      label: WEEKDAYS[i],
      displayStr: `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
    }
  })
}

export default function FixedRaidsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [themeId, setThemeId] = useState("dark")
  const [mounted, setMounted] = useState(false)

  const [guilds, setGuilds] = useState([])
  const [selectedGuildId, setSelectedGuildId] = useState(null)
  const [fixedRaids, setFixedRaids] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [selectedRaid, setSelectedRaid] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ ...EMPTY_FORM })
  const [creating, setCreating] = useState(false)

  const [dragData, setDragData] = useState(null)
  const [dragOverSlot, setDragOverSlot] = useState(null) // { raidId, slotIndex }
  const [toast, setToast] = useState(null) // { message, type: "error"|"success" }
  const toastTimerRef = useRef(null)

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
    if (status !== "authenticated") return
    fetch("/api/discord/guilds")
      .then(r => r.json())
      .then(data => {
        if (!data.guilds?.length) return
        setGuilds(data.guilds)
        setSelectedGuildId(data.guilds[0].id)
      })
      .catch(() => {})
  }, [status])

  useEffect(() => {
    if (!selectedGuildId) return
    setLoading(true)
    setFixedRaids([])
    setMembers([])
    setIsAdmin(false)

    Promise.all([
      fetch(`/api/fixed-raids?guildId=${selectedGuildId}`).then(r => r.json()),
      fetch(`/api/fixed-raids/members?guildId=${selectedGuildId}`).then(r => r.json()),
      fetch(`/api/fixed-raids/admin-check?guildId=${selectedGuildId}`).then(r => r.json()),
    ])
      .then(([raidsData, membersData, adminData]) => {
        setFixedRaids(raidsData.fixedRaids || [])
        setMembers(membersData.members || [])
        setIsAdmin(adminData.isAdmin || false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedGuildId])

  useEffect(() => {
    if (!toast) return
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(toastTimerRef.current)
  }, [toast])

  const showToast = (message, type = "error") => setToast({ message, type })

  const handleCreate = async () => {
    const raidInfo = RAID_LIST.find(r => r.key === createForm.raidKey)
    if (!raidInfo || !createForm.difficulty || !createForm.time) return
    setCreating(true)
    try {
      const res = await fetch("/api/fixed-raids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId: selectedGuildId,
          weekday: createForm.weekday,
          time: createForm.time,
          raidAlias: raidInfo.raidAlias,
          raidName: raidInfo.raidName,
          raidTag: raidInfo.raidTag,
          difficulty: createForm.difficulty,
          difficulty_level: createForm.difficulty_level || null,
          maxPlayers: createForm.maxPlayers,
        }),
      })
      const data = await res.json()
      if (data.fixedRaid) {
        setFixedRaids(prev => [...prev, data.fixedRaid])
        setShowCreateModal(false)
        setCreateForm({ ...EMPTY_FORM })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("이 고정 레이드를 삭제할까요?")) return
    try {
      await fetch(`/api/fixed-raids/${id}`, { method: "DELETE" })
      setFixedRaids(prev => prev.filter(r => r._id !== id))
      if (selectedRaid?._id === id) setSelectedRaid(null)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSlotDrop = async (raidId, slotIndex) => {
    if (!dragData || !isAdmin) return
    const raid = fixedRaids.find(r => r._id === raidId)
    if (!raid) return

    const slot = raid.slots.find(s => s.slotIndex === slotIndex)
    if (!slot) return

    if (slot.isSupporter && dragData.role !== "support") {
      showToast("서포터 전용 슬롯입니다. 서포터 직업만 배치 가능합니다.", "error")
      setDragData(null)
      setDragOverSlot(null)
      return
    }

    const dupChar = raid.slots.find(s => s.slotIndex !== slotIndex && s.characterName === dragData.characterName)
    if (dupChar) {
      showToast("같은 레이드에 동일 캐릭터가 이미 있습니다.", "error")
      setDragData(null)
      setDragOverSlot(null)
      return
    }

    const dupUser = raid.slots.find(s => s.slotIndex !== slotIndex && s.discordId === dragData.discordId)
    if (dupUser) {
      showToast("같은 레이드에 해당 유저가 이미 다른 슬롯에 있습니다.", "error")
      setDragData(null)
      setDragOverSlot(null)
      return
    }

    const updatedSlots = raid.slots.map(s =>
      s.slotIndex === slotIndex
        ? {
            ...s,
            discordId: dragData.discordId,
            serverNick: dragData.serverNick,
            characterName: dragData.characterName,
            characterClass: dragData.characterClass,
            characterLevel: dragData.characterLevel,
            characterCombatPower: dragData.characterCombatPower ?? null,
            role: dragData.role,
          }
        : s
    )

    try {
      const res = await fetch(`/api/fixed-raids/${raidId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: updatedSlots }),
      })
      const data = await res.json()
      if (data.fixedRaid) {
        setFixedRaids(prev => prev.map(r => r._id === raidId ? data.fixedRaid : r))
        if (selectedRaid?._id === raidId) setSelectedRaid(data.fixedRaid)
        showToast(`${dragData.characterName} 배치 완료`, "success")
      } else {
        showToast(data.error || "배치 실패", "error")
      }
    } catch {
      showToast("서버 오류가 발생했습니다.", "error")
    }

    setDragData(null)
    setDragOverSlot(null)
  }

  const handleSlotClear = async (raidId, slotIndex) => {
    if (!isAdmin) return
    const raid = fixedRaids.find(r => r._id === raidId)
    if (!raid) return

    const updatedSlots = raid.slots.map(s =>
      s.slotIndex === slotIndex
        ? { ...s, discordId: null, serverNick: null, characterName: null, characterClass: null, characterLevel: null, characterCombatPower: null, role: null }
        : s
    )

    try {
      const res = await fetch(`/api/fixed-raids/${raidId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: updatedSlots }),
      })
      const data = await res.json()
      if (data.fixedRaid) {
        setFixedRaids(prev => prev.map(r => r._id === raidId ? data.fixedRaid : r))
        if (selectedRaid?._id === raidId) setSelectedRaid(data.fixedRaid)
      } else {
        showToast(data.error || "슬롯 초기화 실패", "error")
      }
    } catch {
      showToast("서버 오류가 발생했습니다.", "error")
    }
  }

  if (!mounted || status === "loading") return null
  if (!session) return null

  const theme = getTheme(themeId)
  const d = theme.isDark
  const weekDates = getWeekDates()

  const inputCls = `w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors
    ${d ? "bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50"
        : "bg-white border-purple-100 text-gray-800 placeholder-gray-400 focus:border-purple-300"}`

  const selectCls = `w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors
    ${d ? "bg-[#1a1f2e] border-white/10 text-white focus:border-amber-500/50"
        : "bg-white border-purple-100 text-gray-800 focus:border-purple-300"}`

  return (
    <DashboardLayout themeId={themeId} setThemeId={setThemeId} session={session} activeNav="fixed-raids">

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-cinzel), serif" }}>
            고정 레이드 관리
          </h1>
          <p className={`text-sm mt-0.5 ${d ? "text-gray-400" : "text-gray-500"}`}>
            매주 고정 레이드 일정 및 멤버를 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`text-xs ${d ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-purple-100 text-purple-700 border-purple-200"}`}>
            📅 수요일 10시 자동 알림
          </Badge>
          {isAdmin && (
            <Badge className={`text-xs flex items-center gap-1 ${d ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "bg-blue-50 text-blue-600 border-blue-200"}`}>
              <Shield size={11} /> 관리자 전용
            </Badge>
          )}
        </div>
      </div>

      {/* 서버 탭 */}
      {guilds.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {guilds.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGuildId(g.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border
                ${selectedGuildId === g.id
                  ? d ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-purple-400 bg-purple-50 text-purple-700"
                  : d ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-purple-100 text-gray-500 hover:bg-purple-50"
                }`}>
              {g.icon
                ? <img src={g.icon} alt={g.name} className="w-5 h-5 rounded-full" />
                : <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                    ${d ? "bg-white/10" : "bg-purple-100 text-purple-600"}`}>{g.name[0]}</span>
              }
              {g.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className={`text-sm text-center py-12 ${d ? "text-gray-500" : "text-gray-400"}`}>
          불러오는 중...
        </div>
      ) : !selectedGuildId ? (
        <div className={`text-sm text-center py-12 ${d ? "text-gray-500" : "text-gray-400"}`}>
          봇이 추가된 서버가 없습니다.
        </div>
      ) : (
        <div className="flex gap-4 items-start">

          {/* 왼쪽: 요일별 캘린더 */}
          <div className="flex-1 min-w-0 space-y-3">
            {weekDates.map(({ weekday, label, displayStr, isToday, isPast }) => {
              const dayRaids = fixedRaids
                .filter(r => r.weekday === weekday)
                .sort((a, b) => a.time.localeCompare(b.time))

              return (
                <div key={weekday} className={`rounded-2xl border overflow-hidden
                  ${d ? "border-white/10 bg-white/[0.02]" : "border-purple-100 bg-white"}`}>

                  {/* 요일 헤더 */}
                  <div className={`flex items-center justify-between px-4 py-2.5 border-b
                    ${d ? "border-white/10" : "border-purple-100"}
                    ${isPast ? d ? "bg-white/[0.01]" : "bg-gray-50" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold
                        ${isToday
                          ? d ? "text-amber-400" : "text-purple-600"
                          : isPast
                            ? d ? "text-gray-600" : "text-gray-300"
                            : d ? "text-gray-200" : "text-gray-700"
                        }`}>
                        {label}
                      </span>
                      <span className={`text-xs
                        ${isPast ? d ? "text-gray-700" : "text-gray-300"
                                 : d ? "text-gray-500" : "text-gray-400"}`}>
                        {displayStr}
                      </span>
                      {isToday && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                          ${d ? "bg-amber-500/20 text-amber-400" : "bg-purple-100 text-purple-600"}`}>
                          오늘
                        </span>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setCreateForm({ ...EMPTY_FORM, weekday })
                          setShowCreateModal(true)
                        }}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors
                          ${d ? "border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"
                              : "border-purple-100 text-gray-500 hover:bg-purple-50 hover:text-purple-700"}`}>
                        <Plus size={12} /> 추가
                      </button>
                    )}
                  </div>

                  {/* 레이드 카드 목록 */}
                  <div className={`p-3 ${dayRaids.length === 0 ? "min-h-[52px]" : "space-y-2"}`}>
                    {dayRaids.length === 0 ? (
                      <p className={`text-xs text-center py-2 ${d ? "text-gray-700" : "text-gray-300"}`}>
                        등록된 고정 레이드 없음
                      </p>
                    ) : (
                      dayRaids.map(raid => (
                        <div
                          key={raid._id}
                          className={`rounded-xl border overflow-hidden
                            ${d ? "border-white/10 bg-white/[0.03]" : "border-purple-100 bg-purple-50/30"}`}>

                          {/* 레이드 헤더 */}
                          <div
                            onClick={() => setSelectedRaid(raid)}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors
                              ${d ? "hover:bg-white/[0.04]" : "hover:bg-purple-50"}`}>
                            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold truncate ${d ? "text-white" : "text-gray-800"}`}>
                                {raid.raidAlias} {raid.difficulty}
                              </span>
                              {raid.difficulty_level && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full
                                  ${d ? "bg-white/10 text-gray-400" : "bg-purple-100 text-purple-600"}`}>
                                  {raid.difficulty_level}
                                </span>
                              )}
                              <span className={`text-xs font-medium ${d ? "text-amber-400" : "text-purple-600"}`}>
                                {raid.time}
                              </span>
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => handleDelete(raid._id)}
                                  className={`p-1.5 rounded-lg transition-colors
                                    ${d ? "text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                                        : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 슬롯 그리드 (드롭 타겟) */}
                          <div className={`px-3 pb-3 grid gap-1.5 ${raid.maxPlayers === 8 ? "grid-cols-4" : "grid-cols-2"}`}>
                            {(raid.slots || []).map(slot => {
                              const isOver = dragOverSlot?.raidId === raid._id && dragOverSlot?.slotIndex === slot.slotIndex
                              return (
                                <div
                                  key={slot.slotIndex}
                                  onDragOver={isAdmin && dragData ? (e) => { e.preventDefault(); setDragOverSlot({ raidId: raid._id, slotIndex: slot.slotIndex }) } : undefined}
                                  onDragLeave={isAdmin ? () => setDragOverSlot(null) : undefined}
                                  onDrop={isAdmin ? (e) => { e.preventDefault(); handleSlotDrop(raid._id, slot.slotIndex) } : undefined}
                                  className={`relative flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs border transition-all
                                    ${isOver
                                      ? d ? "border-amber-400/60 bg-amber-500/15" : "border-purple-400 bg-purple-50"
                                      : slot.discordId
                                        ? slot.isSupporter
                                          ? d ? "border-blue-500/20 bg-blue-500/10" : "border-blue-100 bg-blue-50"
                                          : d ? "border-red-500/20 bg-red-500/10" : "border-red-50 bg-red-50/50"
                                        : d ? "border-white/5 bg-white/[0.02]" : "border-gray-100 bg-gray-50"
                                    }`}>
                                  {slot.isSupporter && <Shield size={10} className={`flex-shrink-0 ${d ? "text-blue-400" : "text-blue-500"}`} />}
                                  <span className={`truncate flex-1 ${
                                    slot.discordId
                                      ? d ? "text-gray-200" : "text-gray-700"
                                      : d ? "text-gray-700" : "text-gray-300"
                                  }`}>
                                    {slot.discordId ? (slot.serverNick || "?") : (isOver ? "여기에 놓기" : "빈")}
                                  </span>
                                  {isAdmin && slot.discordId && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSlotClear(raid._id, slot.slotIndex) }}
                                      className={`flex-shrink-0 rounded p-0.5 transition-colors
                                        ${d ? "text-gray-600 hover:text-red-400 hover:bg-red-500/10"
                                            : "text-gray-300 hover:text-red-500 hover:bg-red-50"}`}>
                                      <X size={9} />
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 오른쪽: 멤버 패널 */}
          <div className="w-[220px] flex-shrink-0 space-y-3">
            <div className={`rounded-2xl border overflow-hidden
              ${d ? "border-white/10 bg-white/[0.02]" : "border-purple-100 bg-white"}`}>
              <div className={`px-3 py-2.5 border-b text-xs font-semibold
                ${d ? "border-white/10 text-gray-400" : "border-purple-100 text-gray-600"}`}>
                서버 멤버 ({members.length}명)
                {isAdmin && <span className={`ml-1 font-normal ${d ? "text-gray-600" : "text-gray-400"}`}>드래그로 배치</span>}
              </div>
              <div className="p-2 space-y-3 max-h-[640px] overflow-y-auto">
                {members.length === 0 ? (
                  <p className={`text-xs text-center py-3 ${d ? "text-gray-600" : "text-gray-400"}`}>
                    캐릭터 연동 유저 없음
                  </p>
                ) : (
                  members.map(member => {
                    const filteredChars = (member.characters || [])
                      .filter(c => c.level >= 1680)
                      .sort((a, b) => b.level - a.level)

                    if (filteredChars.length === 0) return null

                    return (
                      <div key={member.discordId}>
                        <p className={`text-xs font-medium mb-1 truncate ${d ? "text-gray-300" : "text-gray-700"}`}>
                          {member.serverNick}
                        </p>
                        <div className="space-y-1">
                          {filteredChars.map((char, ci) => {
                            const isDragging = dragData?.discordId === member.discordId && dragData?.characterName === char.name
                            return (
                              <div
                                key={ci}
                                draggable={isAdmin}
                                onDragStart={isAdmin ? () => {
                                  setDragData({
                                    discordId: member.discordId,
                                    serverNick: member.serverNick,
                                    characterName: char.name,
                                    characterClass: char.class,
                                    characterLevel: char.level,
                                    characterCombatPower: char.combatPower ?? null,
                                    role: SUPPORTER_CLASSES.includes(char.class) ? "support" : "dealer",
                                  })
                                } : undefined}
                                onDragEnd={isAdmin ? () => { setDragData(null); setDragOverSlot(null) } : undefined}
                                className={`flex flex-col px-2 py-1.5 rounded-lg text-xs transition-opacity
                                  ${d ? "bg-white/5" : "bg-gray-50"}
                                  ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}
                                  ${isDragging ? "opacity-40" : "opacity-100"}`}>
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                                    ${char.role === "support"
                                      ? d ? "bg-blue-400" : "bg-blue-500"
                                      : d ? "bg-red-400" : "bg-red-500"
                                    }`} />
                                  <span className={`font-medium truncate ${d ? "text-gray-200" : "text-gray-700"}`}>
                                    {char.name}
                                  </span>
                                </div>
                                <div className={`pl-3 text-[10px] leading-tight ${d ? "text-gray-500" : "text-gray-400"}`}>
                                  {char.class} · Lv.{char.level}{char.combatPower ? ` · ${char.combatPower.toLocaleString()}` : ""}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <p className={`text-xs leading-relaxed ${d ? "text-gray-600" : "text-gray-400"}`}>
              고정 레이드 관련 문의사항은 서버 관리자에게 문의하세요
            </p>
          </div>
        </div>
      )}

      {/* ── 레이드 상세 팝업 ── */}
      {selectedRaid && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setSelectedRaid(null)}>
          <Card
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border p-5
              ${d ? "bg-[#141824] border-white/15" : "bg-white border-purple-100"}`}>

            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className={`text-base font-bold ${d ? "text-white" : "text-gray-800"}`}>
                  {selectedRaid.raidAlias} {selectedRaid.difficulty}
                  {selectedRaid.difficulty_level && (
                    <span className={`ml-1.5 text-sm font-normal ${d ? "text-gray-400" : "text-gray-500"}`}>
                      ({selectedRaid.difficulty_level})
                    </span>
                  )}
                </h3>
                <p className={`text-sm mt-0.5 ${d ? "text-amber-400" : "text-purple-600"}`}>
                  {WEEKDAYS[selectedRaid.weekday]}요일 {selectedRaid.time}
                </p>
              </div>
              <button
                onClick={() => setSelectedRaid(null)}
                className={`p-1.5 rounded-lg transition-colors ${d ? "text-gray-500 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}>
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5 mb-4">
              {(selectedRaid.slots || []).map(slot => (
                <div key={slot.slotIndex}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm
                    ${slot.discordId
                      ? slot.isSupporter
                        ? d ? "border-blue-500/20 bg-blue-500/10" : "border-blue-100 bg-blue-50"
                        : d ? "border-red-500/20 bg-red-500/10" : "border-red-100 bg-red-50"
                      : d ? "border-white/5 bg-white/[0.02]" : "border-gray-100 bg-gray-50"
                    }`}>
                  <span className={`text-xs w-5 text-center font-medium flex-shrink-0 ${d ? "text-gray-500" : "text-gray-400"}`}>
                    {slot.slotIndex}
                  </span>
                  {slot.isSupporter && <Shield size={13} className={d ? "text-blue-400 flex-shrink-0" : "text-blue-500 flex-shrink-0"} />}
                  {slot.discordId ? (
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium truncate block ${d ? "text-white" : "text-gray-800"}`}>
                        {slot.serverNick || slot.discordId}
                      </span>
                      {slot.characterName && (
                        <span className={`text-xs ${d ? "text-gray-400" : "text-gray-500"}`}>
                          {slot.characterName} ({slot.characterClass}) Lv.{slot.characterLevel}
                          {slot.characterCombatPower ? ` / ${slot.characterCombatPower.toLocaleString()}` : ""}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className={`text-sm ${d ? "text-gray-600" : "text-gray-400"}`}>
                      {slot.isSupporter ? "🛡 서포터 전용" : "빈 슬롯"}
                    </span>
                  )}
                  {isAdmin && slot.discordId && (
                    <button
                      onClick={() => handleSlotClear(selectedRaid._id, slot.slotIndex)}
                      className={`ml-auto flex-shrink-0 p-1 rounded-lg transition-colors
                        ${d ? "text-gray-600 hover:text-red-400 hover:bg-red-500/10"
                            : "text-gray-300 hover:text-red-500 hover:bg-red-50"}`}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              {isAdmin && (
                <Button
                  size="sm"
                  onClick={() => handleDelete(selectedRaid._id)}
                  className="flex items-center gap-1.5 text-xs bg-red-500 hover:bg-red-400 text-white">
                  <Trash2 size={12} /> 삭제
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setSelectedRaid(null)}
                className={`ml-auto text-xs ${d ? "bg-white/10 hover:bg-white/20 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}>
                닫기
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── 레이드 생성 모달 ── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowCreateModal(false)}>
          <Card
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl border p-5
              ${d ? "bg-[#141824] border-white/15" : "bg-white border-purple-100"}`}>

            <div className="flex items-center justify-between mb-5">
              <h3 className={`font-bold text-base ${d ? "text-white" : "text-gray-800"}`}>
                고정 레이드 추가
              </h3>
              <button onClick={() => setShowCreateModal(false)}
                className={`p-1.5 rounded-lg transition-colors ${d ? "text-gray-500 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}>
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${d ? "text-gray-400" : "text-gray-600"}`}>레이드 *</label>
                <select
                  value={createForm.raidKey}
                  onChange={e => {
                    const raidInfo = RAID_LIST.find(r => r.key === e.target.value)
                    setCreateForm(prev => ({ ...prev, raidKey: e.target.value, difficulty: "", maxPlayers: raidInfo?.maxPlayers || 8 }))
                  }}
                  className={selectCls}>
                  <option value="">레이드 선택</option>
                  {RAID_LIST.map(r => (
                    <option key={r.key} value={r.key}>{r.raidAlias} ({r.raidTag}) {r.maxPlayers}인</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${d ? "text-gray-400" : "text-gray-600"}`}>난이도 *</label>
                <select
                  value={createForm.difficulty}
                  onChange={e => setCreateForm(prev => ({ ...prev, difficulty: e.target.value }))}
                  className={selectCls}
                  disabled={!createForm.raidKey}>
                  <option value="">난이도 선택</option>
                  {(RAID_LIST.find(r => r.key === createForm.raidKey)?.difficulties || []).map(diff => (
                    <option key={diff} value={diff}>{diff}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${d ? "text-gray-400" : "text-gray-600"}`}>숙련도</label>
                <div className="flex gap-1.5 flex-wrap">
                  {SKILL_CHOICES.map(s => (
                    <button
                      key={s}
                      onClick={() => setCreateForm(prev => ({ ...prev, difficulty_level: prev.difficulty_level === s ? "" : s }))}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors
                        ${createForm.difficulty_level === s
                          ? d ? "border-amber-500/60 bg-amber-500/15 text-amber-400" : "border-purple-400 bg-purple-50 text-purple-700"
                          : d ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-purple-100 text-gray-500 hover:bg-purple-50"
                        }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${d ? "text-gray-400" : "text-gray-600"}`}>요일 *</label>
                <div className="flex gap-1.5">
                  {WEEKDAYS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => setCreateForm(prev => ({ ...prev, weekday: i }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors
                        ${createForm.weekday === i
                          ? d ? "border-amber-500/60 bg-amber-500/15 text-amber-400" : "border-purple-400 bg-purple-50 text-purple-700"
                          : d ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-purple-100 text-gray-500 hover:bg-purple-50"
                        }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${d ? "text-gray-400" : "text-gray-600"}`}>시간 * (HH:MM)</label>
                <input
                  type="time"
                  value={createForm.time}
                  onChange={e => setCreateForm(prev => ({ ...prev, time: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${d ? "text-gray-400" : "text-gray-600"}`}>인원</label>
                <div className="flex gap-2">
                  {[4, 8].map(n => (
                    <button
                      key={n}
                      onClick={() => setCreateForm(prev => ({ ...prev, maxPlayers: n }))}
                      className={`flex-1 py-2 rounded-xl text-sm border font-medium transition-colors
                        ${createForm.maxPlayers === n
                          ? d ? "border-amber-500/60 bg-amber-500/15 text-amber-400" : "border-purple-400 bg-purple-50 text-purple-700"
                          : d ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-purple-100 text-gray-500 hover:bg-purple-50"
                        }`}>
                      {n}인
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              disabled={creating || !createForm.raidKey || !createForm.difficulty || !createForm.time}
              onClick={handleCreate}
              className={`w-full mt-5 py-2.5 text-sm font-bold
                ${creating || !createForm.raidKey || !createForm.difficulty || !createForm.time
                  ? "opacity-40 cursor-not-allowed bg-gray-500 text-white"
                  : d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"
                }`}>
              {creating ? "생성 중..." : "고정 레이드 추가"}
            </Button>
          </Card>
        </div>
      )}

      {/* ── 토스트 알림 ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
            ${toast.type === "success"
              ? d ? "bg-green-500/90 text-white" : "bg-green-500 text-white"
              : d ? "bg-red-500/90 text-white" : "bg-red-500 text-white"
            }`}>
          <span>{toast.type === "success" ? "✅" : "❌"}</span>
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

    </DashboardLayout>
  )
}
