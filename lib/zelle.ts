export function zelleDeepLink(handle: string, amountCents: number): string {
  const amount = (amountCents / 100).toFixed(2)
  // Zelle doesn't publish an official deep link spec; this is the most common implementation
  return `zelle://payment?amount=${amount}&recipient=${encodeURIComponent(handle)}`
}

export function zelleInstructions(handle: string, amountCents: number): string {
  const amount = `$${(amountCents / 100).toFixed(2)}`
  return `Send ${amount} to ${handle} via Zelle`
}
