import { InvoiceStatus } from '../generated/prisma/enums.js';

const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: [InvoiceStatus.ISSUED, InvoiceStatus.CANCELLED],
  ISSUED: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
  PAID: [],
  CANCELLED: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export interface LineInput {
  unitPrice: number;
  quantity: number;
}

export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

/**
 * All amounts are integer minor currency units. `taxRateBps` is basis points
 * (e.g. 1100 = 11%) so the rate never has to be parsed from a float string.
 */
export function computeTotals(items: LineInput[], taxRateBps: number): InvoiceTotals {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxAmount = Math.round((subtotal * taxRateBps) / 10000);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${String(sequence).padStart(4, '0')}`;
}
