import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { registerAndLogin } from './utils/auth-helper.js';
import { bootstrapTestApp } from './utils/bootstrap-app.js';

describe('Products (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string;

  const email = `products-e2e-${Date.now()}@stockflow.test`;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);
    cookie = await registerAndLogin(app, email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects an unauthenticated request', async () => {
    const response = await request(app.getHttpServer()).get('/products');
    expect(response.status).toBe(401);
  });

  it('rejects creation with a negative price', async () => {
    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookie)
      .send({ sku: 'BAD-1', name: 'Bad', unitPrice: -5, quantityOnHand: 1 });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'unitPrice' })]),
    );
  });

  it('creates a product without leaking internal fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookie)
      .send({ sku: 'WIDGET-1', name: 'Blue Widget', unitPrice: 1999, quantityOnHand: 50 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(String),
      sku: 'WIDGET-1',
      name: 'Blue Widget',
      description: null,
      unitPrice: 1999,
      quantityOnHand: 50,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(response.body.userId).toBeUndefined();
  });

  it('rejects a duplicate SKU for the same user', async () => {
    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookie)
      .send({ sku: 'WIDGET-1', name: 'Duplicate', unitPrice: 100, quantityOnHand: 1 });

    expect(response.status).toBe(409);
  });

  it('allows the same SKU for a different user (per-user uniqueness)', async () => {
    const otherEmail = `products-e2e-other-${Date.now()}@stockflow.test`;
    const otherCookie = await registerAndLogin(app, otherEmail);

    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', otherCookie)
      .send({ sku: 'WIDGET-1', name: 'Someone else’s widget', unitPrice: 100, quantityOnHand: 1 });

    expect(response.status).toBe(201);
    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });

  it('lists products with pagination and finds them by name or SKU search', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookie)
      .send({ sku: 'GADGET-1', name: 'Red Gadget', unitPrice: 2999, quantityOnHand: 10 });

    const page1 = await request(app.getHttpServer())
      .get('/products')
      .query({ page: 1, pageSize: 1 })
      .set('Cookie', cookie);
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(1);
    expect(page1.body.meta).toMatchObject({ page: 1, pageSize: 1, total: 2, totalPages: 2 });

    const byName = await request(app.getHttpServer()).get('/products').query({ search: 'Widget' }).set('Cookie', cookie);
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].sku).toBe('WIDGET-1');

    const bySku = await request(app.getHttpServer()).get('/products').query({ search: 'GADGET' }).set('Cookie', cookie);
    expect(bySku.body.data).toHaveLength(1);
    expect(bySku.body.data[0].name).toBe('Red Gadget');
  });

  it('does not let a user see another user’s products', async () => {
    const otherEmail = `products-e2e-isolated-${Date.now()}@stockflow.test`;
    const otherCookie = await registerAndLogin(app, otherEmail);

    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', otherCookie)
      .send({ sku: 'PRIVATE-1', name: 'Private product', unitPrice: 100, quantityOnHand: 1 });

    const asOwner = await request(app.getHttpServer()).get(`/products/${created.body.id}`).set('Cookie', otherCookie);
    expect(asOwner.status).toBe(200);

    const asOtherUser = await request(app.getHttpServer())
      .get(`/products/${created.body.id}`)
      .set('Cookie', cookie);
    expect(asOtherUser.status).toBe(404);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });

  it('returns 404 for a nonexistent product', async () => {
    const response = await request(app.getHttpServer())
      .get('/products/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookie);
    expect(response.status).toBe(404);
  });

  it('updates a product', async () => {
    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookie)
      .send({ sku: 'UPDATE-ME', name: 'Original', unitPrice: 100, quantityOnHand: 1 });

    const updated = await request(app.getHttpServer())
      .patch(`/products/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ quantityOnHand: 42 });

    expect(updated.status).toBe(200);
    expect(updated.body.quantityOnHand).toBe(42);
    expect(updated.body.name).toBe('Original');
  });

  it('deletes a product not referenced by any invoice', async () => {
    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookie)
      .send({ sku: 'DELETE-ME', name: 'Deletable', unitPrice: 100, quantityOnHand: 1 });

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/products/${created.body.id}`)
      .set('Cookie', cookie);
    expect(deleteResponse.status).toBe(204);

    const getAfterDelete = await request(app.getHttpServer())
      .get(`/products/${created.body.id}`)
      .set('Cookie', cookie);
    expect(getAfterDelete.status).toBe(404);
  });

  it('blocks deleting a product referenced by an invoice line item', async () => {
    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookie)
      .send({ sku: 'REFERENCED-1', name: 'Referenced', unitPrice: 500, quantityOnHand: 5 });
    const productId = created.body.id;

    const invoice = await prisma.invoice.create({
      data: {
        userId,
        invoiceNumber: `INV-TEST-${Date.now()}`,
        customerName: 'Test Customer',
        issueDate: new Date(),
        subtotal: 500,
        taxAmount: 55,
        total: 555,
        items: {
          create: { productId, productName: 'Referenced', unitPrice: 500, quantity: 1, lineTotal: 500 },
        },
      },
    });

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/products/${productId}`)
      .set('Cookie', cookie);
    expect(deleteResponse.status).toBe(409);

    await prisma.invoice.delete({ where: { id: invoice.id } });
  });
});
