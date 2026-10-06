/** Capitalizes the first character of a string. Empty strings pass through unchanged. */
export function capitalizeFirstLetter(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s
}
