/**
 * RFC 4180 CSV serializer with a formula-injection guard. No library -
 * about 20 lines of real logic, per `docs/tech-stack.md`.
 */

/** Cells starting with any of these can be interpreted as a formula by Excel/Sheets when the CSV is opened. */
const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r'])

function neutralizeFormulaInjection(cell: string): string {
  if (cell.length > 0 && FORMULA_TRIGGER_CHARS.has(cell[0])) {
    return `'${cell}`
  }
  return cell
}

function quoteRfc4180(cell: string): string {
  const needsQuoting = /["\r\n,]/.test(cell)
  if (!needsQuoting) return cell
  return `"${cell.replace(/"/g, '""')}"`
}

/** Written first so Excel detects UTF-8 (U+FEFF) instead of guessing the system codepage. */
const UTF8_BOM = '﻿'

/**
 * Serialises a table (rows of cells) to CSV text: RFC 4180 quoting, CRLF
 * line endings, a leading UTF-8 BOM, and a leading apostrophe on any cell
 * that starts with a formula-trigger character.
 */
export function serializeCsv(table: string[][]): string {
  const lines = table.map((row) => row.map((cell) => quoteRfc4180(neutralizeFormulaInjection(cell))).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}
