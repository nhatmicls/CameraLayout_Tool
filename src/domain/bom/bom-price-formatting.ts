const VND_NUMBER_FORMAT = new Intl.NumberFormat('vi-VN')

/** VND amount with vi-VN digit grouping and no currency sign, e.g. "1.250.000" - for cells under a header that already says VND. */
export function formatVndNumber(amountVnd: number): string {
  return VND_NUMBER_FORMAT.format(amountVnd)
}

/** Human-readable VND amount, e.g. "1.250.000 ₫". */
export function formatVnd(amountVnd: number): string {
  return `${formatVndNumber(amountVnd)} ₫`
}
