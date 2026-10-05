/** Class strings and small formatters shared by the properties-panel field components. */

export const fieldLabelClass = 'mt-3 block text-xs font-medium text-neutral-500'

/** Input without a top margin, for use inside a flex row beside a button. */
export const inlineInputClass =
  'w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-blue-600 focus:outline focus:outline-2 focus:outline-blue-600'

export const inputClass = `mt-1 ${inlineInputClass}`

export const secondaryButtonClass =
  'rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 focus:outline focus:outline-2 focus:outline-blue-600'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Formats a metre distance to 1 decimal place. */
export function formatM(value: number): string {
  return `${value.toFixed(1)} m`
}
