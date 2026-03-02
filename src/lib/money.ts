export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount)
}
