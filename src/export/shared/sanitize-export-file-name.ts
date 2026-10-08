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

/**
 * Character-level cleanup ONLY - no extension stripping. Safe to call on a
 * filename FRAGMENT (e.g. a floor name, or a name already combined with
 * other parts) that may legitimately contain a dot that is not a file
 * extension: `sanitizeExportFileName`'s own `TRAILING_EXTENSION_PATTERN`
 * finds the LAST dot in the whole string and treats everything after it as
 * removable, so running it on a multi-part combined string (Low review fix,
 * `build-floor-export-file-name.ts`) can eat real content that happens to
 * follow a floor name's internal dot (e.g. "Level 2.5"). Never applies the
 * `floor-plan` fallback - an empty result here is the caller's problem to
 * guard against (e.g. by always including a non-empty "F{n}" prefix).
 */
export function sanitizeFileNameFragment(text: string): string {
  return text
    .trim()
    .replace(UNSAFE_CHAR_PATTERN, '-')
    .replace(WHITESPACE_PATTERN, '-')
    .replace(REPEATED_DASH_PATTERN, '-')
    .replace(LEADING_TRAILING_DASH_PATTERN, '')
}

export function sanitizeExportFileName(fileName: string): string {
  const withoutExtension = fileName.replace(TRAILING_EXTENSION_PATTERN, '')
  const sanitized = sanitizeFileNameFragment(withoutExtension)
  return sanitized.length > 0 ? sanitized : FALLBACK_STEM
}
