import { RAIDS } from "@/lib/raidCatalog"

// 대화형 레이드 생성 에이전트(/api/agent/chat)에서 쓰는 "원문 텍스트 직접 대조" 필드들.
// Claude의 tool call 판단은 가끔 틀리거나 지어내므로("노벨"을 하드로 오판, 안 물어본
// difficultyLevel을 임의로 채움 등), 이번 턴 유저 원문에 실제로 등장하는 키워드가 있으면
// 그 매칭 결과가 모델 판단을 무조건 이긴다. 새 필드를 결정론적으로 확정하고 싶으면
// 이 파일에 matchXFromText() 함수를 추가하고 route.js에서 같은 자리에서 호출하면 된다.

export const DIFFICULTY_LEVELS = ["헤딩", "트라이", "클경", "반숙", "숙련", "숙제"]

// 원문 텍스트를 직접 스캔해서 raidAlias(+difficulty)를 결정론적으로 확정한다.
export function matchAliasFromText(text) {
  if (!text) return null

  const candidates = []
  for (const cat of RAIDS) {
    for (const r of cat.raids) {
      for (const da of r.difficultyAliases || []) {
        candidates.push({ matchText: da.alias, raidAlias: r.alias, difficulty: da.difficulty ?? null })
      }
      for (const a of r.aliases || []) {
        candidates.push({ matchText: a, raidAlias: r.alias, difficulty: null })
      }
    }
  }

  // 긴 문자열 우선 매칭 — "지평 2단계"가 "지평"보다 먼저 매칭되도록
  candidates.sort((a, b) => b.matchText.length - a.matchText.length)

  for (const c of candidates) {
    if (text.includes(c.matchText)) {
      return { raidAlias: c.raidAlias, difficulty: c.difficulty }
    }
  }
  return null
}

// 원문 텍스트에 실제로 등장하는 숙련도 키워드만 인정 (없으면 null — 기존 값 유지는 호출부 책임)
export function matchDifficultyLevelFromText(text) {
  if (!text) return null

  const sorted = [...DIFFICULTY_LEVELS].sort((a, b) => b.length - a.length)
  for (const level of sorted) {
    if (text.includes(level)) return level
  }
  return null
}

const MOBACHUL_KEYWORDS = ["모바출", "모이면", "모이는대로", "채워지면", "차면", "다 모이면", "어느정도 모이면"]

// 원문에 모바출을 암시하는 키워드가 있으면 true, 없으면 null("이번 턴엔 신호 없음" — false 아님).
// difficultyLevel과 동일하게 "매칭 안 되면 기존 값 유지"가 원칙이라, false 기본값 적용은 호출부(세션 첫 턴 여부 판단)의 책임.
export function matchIsMobaChulFromText(text) {
  if (!text) return null
  return MOBACHUL_KEYWORDS.some(keyword => text.includes(keyword)) ? true : null
}
