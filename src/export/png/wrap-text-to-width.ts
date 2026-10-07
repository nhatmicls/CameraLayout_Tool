/**
 * Greedy word wrap: breaks `text` at spaces into lines no wider than
 * `maxWidthPx`. The measure function is injected (a canvas
 * `measureText(...).width` in the export, a fake in tests), so this stays
 * pure. A single word wider than the line is kept whole on its own line -
 * never split, never truncated. An empty / blank text gives no lines.
 */
export function wrapTextToWidth(text: string, maxWidthPx: number, measureWidthPx: (s: string) => number): string[] {
  const words = text.split(' ').filter((word) => word.length > 0)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && measureWidthPx(candidate) > maxWidthPx) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}
