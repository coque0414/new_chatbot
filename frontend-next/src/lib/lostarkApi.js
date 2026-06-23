const LOSTARK_API = "https://developer-lostark.game.gg"

export async function fetchCharacterSiblings(characterName) {
  const res = await fetch(
    `${LOSTARK_API}/characters/${encodeURIComponent(characterName)}/siblings`,
    {
      headers: {
        Authorization: `bearer ${process.env.LOSTARK_API_KEY}`,
        Accept: "application/json",
      },
    }
  )
  if (!res.ok) return null
  return res.json()
}

export async function fetchCharacterCombatPower(characterName) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(
      `${LOSTARK_API}/armories/characters/${encodeURIComponent(characterName)}?filters=profiles`,
      {
        headers: {
          Authorization: `bearer ${process.env.LOSTARK_API_KEY}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    )
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    return data?.ArmoryProfile?.CombatPower
      ? parseFloat(data.ArmoryProfile.CombatPower.replace(/,/g, ""))
      : null
  } catch {
    return null
  }
}

export async function fetchAndBuildCharacters(representativeName) {
  const siblings = await fetchCharacterSiblings(representativeName)
  if (!siblings) return null

  const characters = []
  for (const char of siblings) {
    const level = parseFloat((char.ItemAvgLevel || "0").replace(/,/g, ""))
    if (level < 1680) continue

    await new Promise(r => setTimeout(r, 200))

    const combatPower = await fetchCharacterCombatPower(char.CharacterName)
    characters.push({
      name: char.CharacterName,
      class: char.CharacterClassName,
      level,
      combatPower,
      server: char.ServerName,
    })
  }
  return characters
}
