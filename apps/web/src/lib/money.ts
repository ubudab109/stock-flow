/** Our API stores money as integer minor units (e.g. cents) — never floats. */
export function minorToDecimalString(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2)
}

export function decimalStringToMinor(value: string): number {
  return Math.round(Number.parseFloat(value) * 100)
}

export function formatMoney(minorUnits: number): string {
  return (minorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
