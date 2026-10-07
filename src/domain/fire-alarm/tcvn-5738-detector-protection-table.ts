/**
 * TCVN 5738:2021 "Phòng cháy chữa cháy - Hệ thống báo cháy tự động - Yêu cầu
 * kỹ thuật" protection-area table for point smoke and heat detectors. Every
 * number below is transcribed from `docs/fire-alarm-catalog-sources.md`
 * ("TCVN 5738:2021 table" section) - the ONLY source for these values; never
 * edit a number here without updating that doc first. No CO row exists in
 * the standard, so a CO detector always resolves to `null` in TCVN mode.
 *
 * Bands are inclusive at the top: "Đến 3,5" (up to 3.5 m) includes exactly
 * 3.5 m; "Lớn hơn 3,5 đến 6,0" (above 3.5 up to 6.0) starts just above 3.5 m.
 * `lookupTcvn5738Row` implements that with `ceilingHeightM <= row.maxCeilingHeightM`
 * against rows kept in strictly increasing height order.
 */
import type { FireDetectorKind } from './fire-alarm-device-types'

export interface Tcvn5738Row {
  /** Top of this height band, metres (inclusive). */
  maxCeilingHeightM: number
  /** Average protected area per detector, m2 (the standard's "Den X" ceiling value). */
  areaM2: number
  /** Max distance between two detectors, metres. */
  spacingM: number
  /** Max distance from a detector to the nearest wall, metres. */
  wallDistanceM: number
}

/** Clause + table citation shown next to a resolved coverage circle in the UI. */
export interface Tcvn5738Citation {
  clause: string
  table: string
}

export const TCVN_5738_EDITION = 'TCVN 5738:2021'

/**
 * Where the table numbers were read (owner decision 2026-10-07): the full-text reprint on
 * dulieuphapluat.vn. Shown as a link wherever a TCVN circle is explained, so the user can
 * open the document the drawing is based on.
 */
export const TCVN_5738_SOURCE_NAME = 'dulieuphapluat.vn'
export const TCVN_5738_SOURCE_URL =
  'https://dulieuphapluat.vn/van-ban/tai-nguyen-moi-truong-van-ban/tieu-chuan-quoc-gia-tcvn-57382021-ve-phong-chay-chua-chay-he-thong-bao-chay-tu-dong-yeu-cau-ky-thuat-1152408.html'

// Clause 6.13, Bảng 1 - point smoke detectors.
export const SMOKE_DETECTOR_ROWS: readonly Tcvn5738Row[] = [
  // "Đến 3,5" / "Đến 85" / "9,0" / "4,5" - Bảng 1 row 1.
  { maxCeilingHeightM: 3.5, areaM2: 85, spacingM: 9.0, wallDistanceM: 4.5 },
  // "Lớn hơn 3,5 đến 6,0" / "Đến 70" / "8,5" / "4,0" - Bảng 1 row 2.
  { maxCeilingHeightM: 6.0, areaM2: 70, spacingM: 8.5, wallDistanceM: 4.0 },
  // "Lớn hơn 6,0 đến 10" / "Đến 65" / "8,0" / "4,0" - Bảng 1 row 3.
  { maxCeilingHeightM: 10, areaM2: 65, spacingM: 8.0, wallDistanceM: 4.0 },
  // "Lớn hơn 10 đến 12" / "Đến 55" / "7,5" / "3,5" - Bảng 1 row 4.
  { maxCeilingHeightM: 12, areaM2: 55, spacingM: 7.5, wallDistanceM: 3.5 },
]

// Clause 6.15.1, Bảng 2 - point heat detectors.
export const HEAT_DETECTOR_ROWS: readonly Tcvn5738Row[] = [
  // "Đến 3,5" / "Đến 25" / "5,0" / "2,5" - Bảng 2 row 1.
  { maxCeilingHeightM: 3.5, areaM2: 25, spacingM: 5.0, wallDistanceM: 2.5 },
  // "Lớn hơn 3,5 đến 6,0" / "Đến 20" / "4,5" / "2,0" - Bảng 2 row 2.
  { maxCeilingHeightM: 6.0, areaM2: 20, spacingM: 4.5, wallDistanceM: 2.0 },
  // "Lớn hơn 6,0 đến 9,0" / "Đến 15" / "4,0" / "2,0" - Bảng 2 row 3.
  { maxCeilingHeightM: 9.0, areaM2: 15, spacingM: 4.0, wallDistanceM: 2.0 },
]

/** `{}` would mean G3 was a no-go; G3 is GO (both sources agree on every cell), so both detector kinds with a printed table are populated. No `co-detector` key - the standard prints no CO table. */
export const TCVN_5738_ROWS: Partial<Record<FireDetectorKind, readonly Tcvn5738Row[]>> = {
  'smoke-detector': SMOKE_DETECTOR_ROWS,
  'heat-detector': HEAT_DETECTOR_ROWS,
}

export const TCVN_5738_CITATIONS: Partial<Record<FireDetectorKind, Tcvn5738Citation>> = {
  'smoke-detector': { clause: '6.13', table: 'Bảng 1' },
  'heat-detector': { clause: '6.15.1', table: 'Bảng 2' },
}

/** Largest `maxCeilingHeightM` across every row in the table - the generic ceiling-height input bound once a table exists. Used later by the project-file schema. */
export const CEILING_HEIGHT_MAX_M = Math.max(
  ...Object.values(TCVN_5738_ROWS)
    .flat()
    .map((row) => row!.maxCeilingHeightM),
)

/** True when at least one detector kind has a printed table (G3 go/no-go at runtime). */
export function isTcvn5738TableAvailable(): boolean {
  return Object.keys(TCVN_5738_ROWS).length > 0
}

/**
 * Looks up the TCVN row for `kind` at `ceilingHeightM`. Returns `'no-table'`
 * when the kind has no printed table (always true for `co-detector`) or the
 * table is empty, `'above-table'` when the height exceeds the tallest band,
 * else the matching row (first row whose `maxCeilingHeightM` is `>=` the
 * given height - rows are kept in strictly increasing height order so this
 * is the correct inclusive-at-the-top band).
 */
export function lookupTcvn5738Row(kind: FireDetectorKind, ceilingHeightM: number): Tcvn5738Row | 'above-table' | 'no-table' {
  const rows = TCVN_5738_ROWS[kind]
  if (rows === undefined || rows.length === 0) return 'no-table'
  const row = rows.find((candidate) => ceilingHeightM <= candidate.maxCeilingHeightM)
  return row ?? 'above-table'
}
