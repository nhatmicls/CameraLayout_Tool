/**
 * Turns the loaded plan image's file name into a safe stem for a downloaded
 * export file: strips the original extension, replaces anything that is
 * not a letter/digit/dash/underscore/space with a dash, collapses runs of
 * dashes/whitespace, and trims leading/trailing dashes. Falls back to
 * `floor-plan` if nothing printable survives (e.g. an all-emoji file name).
 */

const UNSAFE_CHAR_PATTERN = /[^a-zA-Z0-9-_ ]/g
const WHITESPACE_PATTERN = /\s+/g
const REPEATED_DASH_PATTERN = /-+/g
const LEADING_TRAILING_DASH_PATTERN = /^-+|-+$/g
const TRAILING_EXTENSION_PATTERN = /\.[^./\\]+$/
const FALLBACK_STEM = 'floor-plan'

export function sanitizeExportFileName(fileName: string): string {
  const withoutExtension = fileName.replace(TRAILING_EXTENSION_PATTERN, '')

  const sanitized = withoutExtension
    .trim()
    .replace(UNSAFE_CHAR_PATTERN, '-')
    .replace(WHITESPACE_PATTERN, '-')
    .replace(REPEATED_DASH_PATTERN, '-')
    .replace(LEADING_TRAILING_DASH_PATTERN, '')

  return sanitized.length > 0 ? sanitized : FALLBACK_STEM
}
