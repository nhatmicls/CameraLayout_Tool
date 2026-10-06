import { clamp } from '../../domain/shared/clamp'

export interface CommittedNumberRules {
  min: number
  max: number
  /** Round to a whole number (prices). */
  integer?: boolean
  /** False = an empty field is not a value (the input reverts); true = empty means null. */
  allowEmpty: boolean
}

/**
 * What a typed number field commits. `{ value }` = commit that value (null
 * for an allowed empty field); `null` = not a usable entry, revert to the
 * last committed value. A finite number is clamped into [min, max], so
 * whatever reaches the store also passes the project-file schema.
 */
export function parseCommittedNumber(text: string, rules: CommittedNumberRules): { value: number | null } | null {
  const trimmed = text.trim()
  if (trimmed === '') return rules.allowEmpty ? { value: null } : null
  const raw = Number(trimmed)
  if (!Number.isFinite(raw)) return null
  const clamped = clamp(raw, rules.min, rules.max)
  return { value: rules.integer ? clamp(Math.round(clamped), rules.min, rules.max) : clamped }
}
