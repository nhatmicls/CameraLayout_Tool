/**
 * Formats a byte count as a human-readable megabyte figure, one decimal
 * place - the one shared implementation for every size-limit message
 * (image file size, project file size, image-budget warnings) instead of
 * three near-identical copies.
 */
export function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}
