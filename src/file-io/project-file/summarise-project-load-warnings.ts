import { WALLS_CROSS_WARNING } from '../../domain/project-file/project-file-schema'

const MAX_DROP_WARNINGS_SHOWN_IN_FULL = 3

/**
 * One notification text for everything a project load warned about. The
 * per-item "dropped" warnings are shown in full when few, else as the first
 * plus a count. The crossing-walls warning is about the whole file, so it is
 * always shown and never folded into that count.
 */
export function summariseProjectLoadWarnings(warnings: readonly string[]): string {
  const drops = warnings.filter((warning) => warning !== WALLS_CROSS_WARNING)
  const parts: string[] = []
  if (drops.length > MAX_DROP_WARNINGS_SHOWN_IN_FULL) {
    parts.push(`${drops[0]} (+${drops.length - 1} more load warnings)`)
  } else {
    parts.push(...drops)
  }
  if (drops.length < warnings.length) parts.push(WALLS_CROSS_WARNING)
  return parts.join(' ')
}
