// The API stores money as an integer — never a float — but that integer is
// whole Rupiah, not "cents". IDR (like JPY/KRW) is a zero-decimal currency:
// there is no minor unit in practical use, so no /100 conversion happens
// anywhere in this file. See ProductFormModal for the matching plain-integer
// price input.
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}
