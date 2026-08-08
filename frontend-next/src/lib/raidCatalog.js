export const RAIDS = [
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
        ],
        aliases: ["4막"],
        difficultyAliases: [
          { alias: "4막 노말", difficulty: "노말" },
          { alias: "4막 하드", difficulty: "하드" },
          { alias: "아르모체" },
          { alias: "노르모체", difficulty: "노말" },
          { alias: "하르모체", difficulty: "하드" },
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
        ],
        aliases: ["종막"],
        difficultyAliases: [
          { alias: "종막 노말", difficulty: "노말" },
          { alias: "종막 하드", difficulty: "하드" },
          { alias: "카제로스" },
          { alias: "노제로스", difficulty: "노말" },
          { alias: "하제로스", difficulty: "하드" },
          { alias: "카제로스 노말", difficulty: "노말" },
          { alias: "카제로스 하드", difficulty: "하드" },
          { alias: "노제", difficulty: "노말" },
          { alias: "하제", difficulty: "하드" },
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
        ],
        aliases: ["세르카"],
        difficultyAliases: [
          { alias: "세르카 노말", difficulty: "노말" },
          { alias: "세르카 하드", difficulty: "하드" },
          { alias: "세르카 나메", difficulty: "나이트메어" },
          { alias: "노르카", difficulty: "노말" },
          { alias: "하르카", difficulty: "하드" },
          { alias: "나르카", difficulty: "나이트메어" },
        ]
      },
      {
        name: "벨가르딘",
        alias: "벨가르딘",
        tag: "그림자",
        maxPlayers: 8,
        difficulties: [
          { name: "노말", level: 1750 },
          { name: "하드", level: 1770 },
          { name: "나이트메어", level: 1780 },
        ],
        aliases: ["벨가"],
        difficultyAliases: [
          { alias: "벨가 노말", difficulty: "노말" },
          { alias: "벨가 하드", difficulty: "하드" },
          { alias: "벨가 나메", difficulty: "나이트메어" },
          { alias: "노벨", difficulty: "노말" },
          { alias: "하벨", difficulty: "하드" },
          { alias: "나벨", difficulty: "나이트메어" },
          { alias: "노가르딘", difficulty: "노말" },
          { alias: "하가르딘", difficulty: "하드" },
          { alias: "나가르딘", difficulty: "나이트메어" },
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
        ],
        aliases: ["지평", "성당", "성심당", "지평막걸리"],
        difficultyAliases: [
          { alias: "지평 1단계", difficulty: "1단계" },
          { alias: "지평 2단계", difficulty: "2단계" },
          { alias: "지평 3단계", difficulty: "3단계" },
          { alias: "성당 1단계", difficulty: "1단계" },
          { alias: "성당 2단계", difficulty: "2단계" },
          { alias: "성당 3단계", difficulty: "3단계" },
        ]
      },
    ]
  },
]

// 원문 텍스트를 직접 스캔해서 raidAlias(+difficulty)를 결정론적으로 확정한다.
// LLM의 별칭 해석은 가끔 틀리므로("노벨"을 하드로 오판하는 등), 원문에 별칭 문자열이
// 그대로 포함돼 있으면 모델 판단보다 이 매칭 결과를 우선한다.
export function resolveAliasFromText(text) {
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
