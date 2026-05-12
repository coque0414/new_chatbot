export const TRAIN_PRESETS = {
  1680: {
    label: "1680 노노하 3종",
    maxPlayers: 8,
    options: [
      {
        id: "1680_3",
        label: "노노하 3종",
        trainLabel: "1680 노노하 3종 기차 (3막 노말 + 2막 노말 + 1막 하드)",
        raids: [
          { alias: "모르둠", tag: "3막", name: "칠흑, 폭풍의 밤", difficulty: "노말", maxPlayers: 8 },
          { alias: "아브렐슈드", tag: "2막", name: "부유하는 악몽의 진혼곡", difficulty: "노말", maxPlayers: 8 },
          { alias: "에기르", tag: "1막", name: "대지를 부수는 업화의 궤적", difficulty: "하드", maxPlayers: 8 },
        ]
      }
    ]
  },
  1700: {
    label: "1700 3종",
    maxPlayersOptions: [4, 8],
    options: [
      {
        id: "1700_3",
        label: "1700 3종",
        trainLabel: "1700 3종 기차 (3막 하드 + 4막 노말 + 성당 1단계)",
        raids: [
          { alias: "아르모체", tag: "4막", name: "파멸의 성채", difficulty: "노말", maxPlayers: 8 },
          { alias: "지평의 성당", tag: "성당", name: "아르세노스", difficulty: "1단계", maxPlayers: 4 },
          { alias: "모르둠", tag: "3막", name: "칠흑, 폭풍의 밤", difficulty: "하드", maxPlayers: 8 },
        ]
      }
    ]
  },
  1710: {
    label: "1710 3종/4종",
    maxPlayersOptions: [4, 8],
    options: [
      {
        id: "1710_3_성당",
        label: "3종 (지평의 성당 1단계)",
        trainLabel: "1710 3종 기차 (세르카 노말 + 종막 노말 + 성당 1단계)",
        raids: [
          { alias: "세르카", tag: "그림자", name: "세르카", difficulty: "노말", maxPlayers: 4 },
          { alias: "카제로스", tag: "종막", name: "최후의 날", difficulty: "노말", maxPlayers: 8 },
          { alias: "지평의 성당", tag: "성당", name: "아르세노스", difficulty: "1단계", maxPlayers: 4 },
        ]
      },
      {
        id: "1710_3_아르모체",
        label: "3종 (아르모체 노말)",
        trainLabel: "1710 3종 기차 (세르카 노말 + 종막 노말 + 4막 노말)",
        raids: [
          { alias: "세르카", tag: "그림자", name: "세르카", difficulty: "노말", maxPlayers: 4 },
          { alias: "카제로스", tag: "종막", name: "최후의 날", difficulty: "노말", maxPlayers: 8 },
          { alias: "아르모체", tag: "4막", name: "파멸의 성채", difficulty: "노말", maxPlayers: 8 },
        ]
      },
      {
        id: "1710_4",
        label: "4종 (전부)",
        trainLabel: "1710 4종 기차 (세르카 노말 + 종막 노말 + 4막 노말 + 성당 1단계)",
        raids: [
          { alias: "세르카", tag: "그림자", name: "세르카", difficulty: "노말", maxPlayers: 4 },
          { alias: "카제로스", tag: "종막", name: "최후의 날", difficulty: "노말", maxPlayers: 8 },
          { alias: "아르모체", tag: "4막", name: "파멸의 성채", difficulty: "노말", maxPlayers: 8 },
          { alias: "지평의 성당", tag: "성당", name: "아르세노스", difficulty: "1단계", maxPlayers: 4 },
        ]
      }
    ]
  },
  1720: {
    label: "1720 3종/4종",
    maxPlayersOptions: [4, 8],
    options: [
      {
        id: "1720_3_성당",
        label: "3종 (지평의 성당 2단계)",
        trainLabel: "1720 3종 기차 (세르카 노말 + 종막 노말 + 성당 2단계)",
        raids: [
          { alias: "세르카", tag: "그림자", name: "세르카", difficulty: "노말", maxPlayers: 4 },
          { alias: "카제로스", tag: "종막", name: "최후의 날", difficulty: "노말", maxPlayers: 8 },
          { alias: "지평의 성당", tag: "성당", name: "아르세노스", difficulty: "2단계", maxPlayers: 4 },
        ]
      },
      {
        id: "1720_3_아르모체",
        label: "3종 (아르모체 하드)",
        trainLabel: "1720 3종 기차 (세르카 노말 + 종막 노말 + 4막 하드)",
        raids: [
          { alias: "세르카", tag: "그림자", name: "세르카", difficulty: "노말", maxPlayers: 4 },
          { alias: "카제로스", tag: "종막", name: "최후의 날", difficulty: "노말", maxPlayers: 8 },
          { alias: "아르모체", tag: "4막", name: "파멸의 성채", difficulty: "하드", maxPlayers: 8 },
        ]
      },
      {
        id: "1720_4",
        label: "4종 (전부)",
        trainLabel: "1720 4종 기차 (세르카 노말 + 종막 노말 + 4막 하드 + 성당 2단계)",
        raids: [
          { alias: "세르카", tag: "그림자", name: "세르카", difficulty: "노말", maxPlayers: 4 },
          { alias: "카제로스", tag: "종막", name: "최후의 날", difficulty: "노말", maxPlayers: 8 },
          { alias: "아르모체", tag: "4막", name: "파멸의 성채", difficulty: "하드", maxPlayers: 8 },
          { alias: "지평의 성당", tag: "성당", name: "아르세노스", difficulty: "2단계", maxPlayers: 4 },
        ]
      }
    ]
  },
  1750: {
    label: "1750 3종/4종",
    maxPlayersOptions: [4, 8],
    options: [
      {
        id: "1750_3",
        label: "1750 3종",
        trainLabel: "1750 3종 기차 (세르카 나이트메어 + 종막 하드 + 지평 3단계)",
        raids: [
          { alias: "세르카", tag: "그림자", name: "세르카", difficulty: "나이트메어", maxPlayers: 4 },
          { alias: "카제로스", tag: "종막", name: "최후의 날", difficulty: "하드", maxPlayers: 8 },
          { alias: "지평의 성당", tag: "성당", name: "아르세노스", difficulty: "3단계", maxPlayers: 4 },
        ]
      },
      {
        id: "1750_4",
        label: "1750 4종",
        trainLabel: "1750 4종 기차 (세르카 나이트메어 + 종막 하드 + 지평 3단계 + 4막 하드)",
        raids: [
          { alias: "세르카", tag: "그림자", name: "세르카", difficulty: "나이트메어", maxPlayers: 4 },
          { alias: "카제로스", tag: "종막", name: "최후의 날", difficulty: "하드", maxPlayers: 8 },
          { alias: "지평의 성당", tag: "성당", name: "아르세노스", difficulty: "3단계", maxPlayers: 4 },
          { alias: "아르모체", tag: "4막", name: "파멸의 성채", difficulty: "하드", maxPlayers: 8 },
        ]
      }
    ]
  },
  1730: {
    label: "1730 3종/4종",
    maxPlayersOptions: [4, 8],
    options: [
      {
        id: "1730_3_성당",
        label: "3종 (지평의 성당 2단계)",
        trainLabel: "1730 3종 기차 (세르카 하드 + 종막 하드 + 성당 2단계)",
        raids: [
          { alias: "세르카", tag: "그림자", name: "세르카", difficulty: "하드", maxPlayers: 4 },
          { alias: "카제로스", tag: "종막", name: "최후의 날", difficulty: "하드", maxPlayers: 8 },
          { alias: "지평의 성당", tag: "성당", name: "아르세노스", difficulty: "2단계", maxPlayers: 4 },
        ]
      },
      {
        id: "1730_3_아르모체",
        label: "3종 (아르모체 하드)",
        trainLabel: "1730 3종 기차 (세르카 하드 + 종막 하드 + 4막 하드)",
        raids: [
          { alias: "세르카", tag: "그림자", name: "세르카", difficulty: "하드", maxPlayers: 4 },
          { alias: "카제로스", tag: "종막", name: "최후의 날", difficulty: "하드", maxPlayers: 8 },
          { alias: "아르모체", tag: "4막", name: "파멸의 성채", difficulty: "하드", maxPlayers: 8 },
        ]
      },
      {
        id: "1730_4",
        label: "4종 (전부)",
        trainLabel: "1730 4종 기차 (세르카 하드 + 종막 하드 + 4막 하드 + 성당 2단계)",
        raids: [
          { alias: "세르카", tag: "그림자", name: "세르카", difficulty: "하드", maxPlayers: 4 },
          { alias: "카제로스", tag: "종막", name: "최후의 날", difficulty: "하드", maxPlayers: 8 },
          { alias: "아르모체", tag: "4막", name: "파멸의 성채", difficulty: "하드", maxPlayers: 8 },
          { alias: "지평의 성당", tag: "성당", name: "아르세노스", difficulty: "2단계", maxPlayers: 4 },
        ]
      }
    ]
  }
}

// trainKey로 preset 옵션 조회
export function getTrainPreset(trainKey) {
  for (const tier of Object.values(TRAIN_PRESETS)) {
    for (const option of tier.options) {
      if (option.id === trainKey) return option
    }
  }
  return null
}
