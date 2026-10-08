/**
 * The project-wide BOM panel / CSV notice naming floors that hold at least
 * one cable but have no scale set, so their metres are silently left out of
 * the project cable total - never just a shorter number with no
 * explanation. `position` is 1-based (`F{position}`), matching the floor's
 * own tab/label position.
 */
export interface FloorWithoutCableScale {
  position: number
  name: string
}

/** `"No cable metres for F2 Level 2, F3 Level 3: scale not set."`; `null` when the list is empty. */
export function describeFloorsWithoutCableScale(floors: readonly FloorWithoutCableScale[]): string | null {
  if (floors.length === 0) return null
  const names = floors.map((floor) => `F${floor.position} ${floor.name}`)
  return `No cable metres for ${names.join(', ')}: scale not set.`
}
