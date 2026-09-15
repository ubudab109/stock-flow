import PDFDocument from 'pdfkit';
import type { InvoiceRecord } from './invoices.service.js';

function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString('en-CA') : '—';
}

const MARGIN = 50;
const COLUMNS = { product: MARGIN, quantity: 300, unitPrice: 370, lineTotal: 470 };
const PAGE_WIDTH = 595.28; // A4 in points

/**
 * Renders a plain, functional one-page invoice PDF. Returns the document
 * un-ended — the caller must `.pipe()` it to a destination and then call
 * `.end()`, in that order, which is pdfkit's standard streaming contract.
 */
export function generateInvoicePdf(invoice: InvoiceRecord): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });

  doc.fontSize(20).text('StockFlow', MARGIN, MARGIN);
  doc.fontSize(10).fillColor('#666666').text('Inventory & Invoicing', MARGIN, MARGIN + 24);

  doc
    .fontSize(16)
    .fillColor('#000000')
    .text(invoice.invoiceNumber, MARGIN, MARGIN, { align: 'right', width: PAGE_WIDTH - MARGIN * 2 });
  doc
    .fontSize(10)
    .fillColor('#666666')
    .text(invoice.status, MARGIN, MARGIN + 22, { align: 'right', width: PAGE_WIDTH - MARGIN * 2 });

  doc.moveDown(3);
  const infoTop = doc.y;
  doc.fontSize(11).fillColor('#000000');
  doc.text('Bill to', MARGIN, infoTop);
  doc.fontSize(12).text(invoice.customerName, MARGIN, infoTop + 16);

  doc.fontSize(11).text('Issue date', 350, infoTop);
  doc.fontSize(12).text(formatDate(invoice.issueDate), 350, infoTop + 16);
  doc.fontSize(11).text('Due date', 460, infoTop);
  doc.fontSize(12).text(formatDate(invoice.dueDate), 460, infoTop + 16);

  let y = infoTop + 60;
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE_WIDTH - MARGIN, y)
    .strokeColor('#dddddd')
    .stroke();
  y += 10;

  doc.fontSize(10).fillColor('#666666');
  doc.text('Product', COLUMNS.product, y);
  doc.text('Qty', COLUMNS.quantity, y);
  doc.text('Unit price', COLUMNS.unitPrice, y);
  doc.text('Line total', COLUMNS.lineTotal, y);
  y += 16;
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE_WIDTH - MARGIN, y)
    .strokeColor('#dddddd')
    .stroke();
  y += 10;

  doc.fillColor('#000000').fontSize(11);
  for (const item of invoice.items) {
    doc.text(item.productName, COLUMNS.product, y, { width: 240 });
    doc.text(String(item.quantity), COLUMNS.quantity, y);
    doc.text(formatIdr(item.unitPrice), COLUMNS.unitPrice, y);
    doc.text(formatIdr(item.lineTotal), COLUMNS.lineTotal, y);
    y += 22;
  }

  y += 10;
  doc
    .moveTo(COLUMNS.unitPrice, y)
    .lineTo(PAGE_WIDTH - MARGIN, y)
    .strokeColor('#dddddd')
    .stroke();
  y += 10;

  doc.fontSize(11).fillColor('#666666').text('Subtotal', COLUMNS.unitPrice, y);
  doc.fillColor('#000000').text(formatIdr(invoice.subtotal), COLUMNS.lineTotal, y);
  y += 18;
  doc.fillColor('#666666').text('Tax', COLUMNS.unitPrice, y);
  doc.fillColor('#000000').text(formatIdr(invoice.taxAmount), COLUMNS.lineTotal, y);
  y += 18;
  doc.fontSize(12).fillColor('#666666').text('Total', COLUMNS.unitPrice, y);
  doc.fillColor('#000000').text(formatIdr(invoice.total), COLUMNS.lineTotal, y);

  if (invoice.notes) {
    y += 40;
    doc.fontSize(10).fillColor('#666666').text('Notes', MARGIN, y);
    doc.fillColor('#000000').text(invoice.notes, MARGIN, y + 14, { width: PAGE_WIDTH - MARGIN * 2 });
  }

  return doc;
}
