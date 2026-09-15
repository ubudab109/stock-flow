import { canTransition, computeTotals, formatInvoiceNumber } from './invoice.utils.js';

describe('canTransition', () => {
  it('allows DRAFT to ISSUED or CANCELLED', () => {
    expect(canTransition('DRAFT', 'ISSUED')).toBe(true);
    expect(canTransition('DRAFT', 'CANCELLED')).toBe(true);
  });

  it('allows ISSUED to PAID or CANCELLED', () => {
    expect(canTransition('ISSUED', 'PAID')).toBe(true);
    expect(canTransition('ISSUED', 'CANCELLED')).toBe(true);
  });

  it('rejects skipping straight from DRAFT to PAID', () => {
    expect(canTransition('DRAFT', 'PAID')).toBe(false);
  });

  it('treats PAID and CANCELLED as terminal', () => {
    expect(canTransition('PAID', 'ISSUED')).toBe(false);
    expect(canTransition('PAID', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'DRAFT')).toBe(false);
    expect(canTransition('CANCELLED', 'ISSUED')).toBe(false);
  });

  it('rejects a no-op transition to the same status', () => {
    expect(canTransition('DRAFT', 'DRAFT')).toBe(false);
    expect(canTransition('ISSUED', 'ISSUED')).toBe(false);
  });
});

describe('computeTotals', () => {
  it('computes subtotal, tax, and total using integer minor units', () => {
    const totals = computeTotals([{ unitPrice: 1999, quantity: 2 }], 1100);
    expect(totals.subtotal).toBe(3998);
    expect(totals.taxAmount).toBe(440); // round(3998 * 0.11) = round(439.78) = 440
    expect(totals.total).toBe(4438);
  });

  it('sums multiple lines before applying tax', () => {
    const totals = computeTotals(
      [
        { unitPrice: 1000, quantity: 3 },
        { unitPrice: 500, quantity: 1 },
      ],
      1100,
    );
    expect(totals.subtotal).toBe(3500);
    expect(totals.taxAmount).toBe(385);
    expect(totals.total).toBe(3885);
  });

  it('returns zero totals for no items', () => {
    expect(computeTotals([], 1100)).toEqual({ subtotal: 0, taxAmount: 0, total: 0 });
  });

  it('never produces a fractional amount regardless of the rate', () => {
    const totals = computeTotals([{ unitPrice: 333, quantity: 1 }], 750);
    expect(Number.isInteger(totals.taxAmount)).toBe(true);
    expect(Number.isInteger(totals.total)).toBe(true);
  });
});

describe('formatInvoiceNumber', () => {
  it('pads the sequence to 4 digits', () => {
    expect(formatInvoiceNumber(2026, 1)).toBe('INV-2026-0001');
    expect(formatInvoiceNumber(2026, 42)).toBe('INV-2026-0042');
  });

  it('does not truncate a sequence larger than 4 digits', () => {
    expect(formatInvoiceNumber(2026, 12345)).toBe('INV-2026-12345');
  });
});
