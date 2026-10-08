import { capitalizeFirstLetter } from './capitalize-first-letter'

// Brands whose printed name is not just the catalog id with a capital first letter.
const BRAND_DISPLAY_LABELS: Record<string, string> = {
  aolin: 'AoLin',
}

/** Display name of a catalog brand id (e.g. `hikvision` -> "Hikvision", `aolin` -> "AoLin"). */
export function brandDisplayLabel(brand: string): string {
  return BRAND_DISPLAY_LABELS[brand] ?? capitalizeFirstLetter(brand)
}
