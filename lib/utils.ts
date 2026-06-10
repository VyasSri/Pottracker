export function formatCents(cents: number): string {
  const abs = Math.abs(cents)
  const dollars = (abs / 100).toFixed(2)
  const formatted = dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${cents < 0 ? '-' : ''}$${formatted}`
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
