import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { registerAndLogin } from './utils/auth-helper.js';
import { bootstrapTestApp } from './utils/bootstrap-app.js';

describe('Invoices (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let widgetId: string;
  let gadgetId: string;

  const email = `invoices-e2e-${Date.now()}@stockflow.test`;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);
    cookie = await registerAndLogin(app, email);

    const widget = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookie)
      .send({ sku: 'WIDGET-INV', name: 'Widget', unitPrice: 1000, quantityOnHand: 10 });
    widgetId = widget.body.id;

    const gadget = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookie)
      .send({ sku: 'GADGET-INV', name: 'Gadget', unitPrice: 2500, quantityOnHand: 5 });
    gadgetId = gadget.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects an unauthenticated request', async () => {
    const response = await request(app.getHttpServer()).get('/invoices');
    expect(response.status).toBe(401);
  });

  it('computes subtotal/tax/total server-side and ignores client-supplied totals', async () => {
    const response = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', cookie)
      .send({
        customerName: 'Acme Corp',
        items: [{ productId: widgetId, quantity: 2 }],
        // Not part of CreateInvoiceDto — whitelist rejection proves the
        // server never accepts client-sent totals (V2).
        total: 1,
      });

    expect(response.status).toBe(400);
  });

  it('creates a draft invoice with server-computed totals and snapshotted line data', async () => {
    const response = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', cookie)
      .send({ customerName: 'Acme Corp', items: [{ productId: widgetId, quantity: 2 }] });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('DRAFT');
    expect(response.body.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(response.body.subtotal).toBe(2000);
    expect(response.body.taxAmount).toBe(220); // 11% of 2000
    expect(response.body.total).toBe(2220);
    expect(response.body.items).toEqual([
      expect.objectContaining({ productId: widgetId, productName: 'Widget', unitPrice: 1000, quantity: 2, lineTotal: 2000 }),
    ]);
  });

  it('rejects an invoice line that exceeds available stock, naming the product', async () => {
    const response = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', cookie)
      .send({ customerName: 'Acme Corp', items: [{ productId: gadgetId, quantity: 999 }] });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('Gadget');
  });

  it('validates cumulative stock across duplicate lines for the same product', async () => {
    // 3 + 3 = 6 > 5 in stock, even though each individual line is <= 5
    const response = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', cookie)
      .send({
        customerName: 'Acme Corp',
        items: [
          { productId: gadgetId, quantity: 3 },
          { productId: gadgetId, quantity: 3 },
        ],
      });

    expect(response.status).toBe(409);
  });

  it('does not let changing a product’s price affect an existing invoice', async () => {
    const created = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', cookie)
      .send({ customerName: 'Price Snapshot Co', items: [{ productId: widgetId, quantity: 1 }] });
    const originalUnitPrice = created.body.items[0].unitPrice;

    await request(app.getHttpServer())
      .patch(`/products/${widgetId}`)
      .set('Cookie', cookie)
      .send({ unitPrice: 999999 });

    const reFetched = await request(app.getHttpServer())
      .get(`/invoices/${created.body.id}`)
      .set('Cookie', cookie);
    expect(reFetched.body.items[0].unitPrice).toBe(originalUnitPrice);
    expect(reFetched.body.subtotal).toBe(created.body.subtotal);

    // restore price for subsequent tests
    await request(app.getHttpServer()).patch(`/products/${widgetId}`).set('Cookie', cookie).send({ unitPrice: 1000 });
  });

  it('rejects illegal status transitions', async () => {
    const draft = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', cookie)
      .send({ customerName: 'Transition Co', items: [{ productId: widgetId, quantity: 1 }] });

    const skipToPaid = await request(app.getHttpServer()).post(`/invoices/${draft.body.id}/pay`).set('Cookie', cookie);
    expect(skipToPaid.status).toBe(409);

    const cancelled = await request(app.getHttpServer())
      .post(`/invoices/${draft.body.id}/cancel`)
      .set('Cookie', cookie);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const reIssueAfterCancel = await request(app.getHttpServer())
      .post(`/invoices/${draft.body.id}/issue`)
      .set('Cookie', cookie);
    expect(reIssueAfterCancel.status).toBe(409);
  });

  it('only allows editing a DRAFT invoice', async () => {
    const draft = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', cookie)
      .send({ customerName: 'Edit Co', items: [{ productId: widgetId, quantity: 1 }] });

    await request(app.getHttpServer()).post(`/invoices/${draft.body.id}/issue`).set('Cookie', cookie).expect(200);

    const editAfterIssue = await request(app.getHttpServer())
      .patch(`/invoices/${draft.body.id}`)
      .set('Cookie', cookie)
      .send({ customerName: 'Renamed Co' });
    expect(editAfterIssue.status).toBe(409);

    await request(app.getHttpServer()).post(`/invoices/${draft.body.id}/cancel`).set('Cookie', cookie);
  });

  it('cancelling a DRAFT invoice restores nothing (stock was never touched)', async () => {
    const before = await request(app.getHttpServer()).get(`/products/${widgetId}`).set('Cookie', cookie);

    const draft = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', cookie)
      .send({ customerName: 'Draft Cancel Co', items: [{ productId: widgetId, quantity: 1 }] });
    await request(app.getHttpServer()).post(`/invoices/${draft.body.id}/cancel`).set('Cookie', cookie).expect(200);

    const after = await request(app.getHttpServer()).get(`/products/${widgetId}`).set('Cookie', cookie);
    expect(after.body.quantityOnHand).toBe(before.body.quantityOnHand);
  });

  it('issuing decrements stock, and cancelling an issued invoice restores it', async () => {
    const before = await request(app.getHttpServer()).get(`/products/${widgetId}`).set('Cookie', cookie);
    const startingStock = before.body.quantityOnHand;

    const invoice = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', cookie)
      .send({ customerName: 'Stock Co', items: [{ productId: widgetId, quantity: 4 }] });

    const issued = await request(app.getHttpServer())
      .post(`/invoices/${invoice.body.id}/issue`)
      .set('Cookie', cookie);
    expect(issued.status).toBe(200);
    expect(issued.body.status).toBe('ISSUED');

    const afterIssue = await request(app.getHttpServer()).get(`/products/${widgetId}`).set('Cookie', cookie);
    expect(afterIssue.body.quantityOnHand).toBe(startingStock - 4);

    const cancelled = await request(app.getHttpServer())
      .post(`/invoices/${invoice.body.id}/cancel`)
      .set('Cookie', cookie);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const afterCancel = await request(app.getHttpServer()).get(`/products/${widgetId}`).set('Cookie', cookie);
    expect(afterCancel.body.quantityOnHand).toBe(startingStock);
  });

  it('takes an invoice through DRAFT -> ISSUED -> PAID', async () => {
    const invoice = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', cookie)
      .send({ customerName: 'Happy Path Co', items: [{ productId: widgetId, quantity: 1 }] });

    await request(app.getHttpServer()).post(`/invoices/${invoice.body.id}/issue`).set('Cookie', cookie).expect(200);
    const paid = await request(app.getHttpServer()).post(`/invoices/${invoice.body.id}/pay`).set('Cookie', cookie);

    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('PAID');

    const cancelAfterPaid = await request(app.getHttpServer())
      .post(`/invoices/${invoice.body.id}/cancel`)
      .set('Cookie', cookie);
    expect(cancelAfterPaid.status).toBe(409);
  });

  it('lists invoices with pagination and filters by status', async () => {
    const list = await request(app.getHttpServer())
      .get('/invoices')
      .query({ status: 'CANCELLED', pageSize: 100 })
      .set('Cookie', cookie);

    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    expect(list.body.data.every((inv: { status: string }) => inv.status === 'CANCELLED')).toBe(true);
  });

  it('searches invoices by customer name and by invoice number', async () => {
    const created = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', cookie)
      .send({ customerName: 'Searchable Customer Ltd', items: [{ productId: widgetId, quantity: 1 }] });

    const byCustomer = await request(app.getHttpServer())
      .get('/invoices')
      .query({ search: 'Searchable Customer' })
      .set('Cookie', cookie);
    expect(byCustomer.status).toBe(200);
    expect(byCustomer.body.data.some((inv: { id: string }) => inv.id === created.body.id)).toBe(true);

    const byNumber = await request(app.getHttpServer())
      .get('/invoices')
      .query({ search: created.body.invoiceNumber })
      .set('Cookie', cookie);
    expect(byNumber.body.data).toHaveLength(1);
    expect(byNumber.body.data[0].id).toBe(created.body.id);

    const noMatch = await request(app.getHttpServer())
      .get('/invoices')
      .query({ search: 'no-such-customer-exists' })
      .set('Cookie', cookie);
    expect(noMatch.body.data).toHaveLength(0);
  });

  it('does not let a user access another user’s invoice', async () => {
    const otherEmail = `invoices-e2e-other-${Date.now()}@stockflow.test`;
    const otherCookie = await registerAndLogin(app, otherEmail);

    const invoice = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', cookie)
      .send({ customerName: 'Isolated Co', items: [{ productId: widgetId, quantity: 1 }] });

    const asOtherUser = await request(app.getHttpServer())
      .get(`/invoices/${invoice.body.id}`)
      .set('Cookie', otherCookie);
    expect(asOtherUser.status).toBe(404);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
