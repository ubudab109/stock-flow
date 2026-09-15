import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bootstrapTestApp } from './utils/bootstrap-app.js';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const email = `auth-e2e-${Date.now()}@stockflow.test`;
  const password = 'Passw0rd!';

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects a weak password on registration', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'weak@stockflow.test', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'password' })]),
    );
  });

  it('registers a new user', async () => {
    const response = await request(app.getHttpServer()).post('/auth/register').send({ email, password });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: expect.any(String), email });
  });

  it('rejects registering the same email twice', async () => {
    const response = await request(app.getHttpServer()).post('/auth/register').send({ email, password });

    expect(response.status).toBe(409);
  });

  it('rejects login with a wrong password with a generic message', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password');
  });

  it('rejects login for an email that does not exist, with the same generic message', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody-at-all@stockflow.test', password: 'whatever' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password');
  });

  it('rejects an unauthenticated request to a protected route', async () => {
    const response = await request(app.getHttpServer()).get('/auth/me');

    expect(response.status).toBe(401);
  });

  it('logs in, accesses a protected route, then logs out and loses access', async () => {
    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.email).toBe(email);

    const cookie = loginResponse.headers['set-cookie'];
    expect(cookie).toBeDefined();

    const meResponse = await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie);
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.email).toBe(email);

    const logoutResponse = await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie);
    expect(logoutResponse.status).toBe(204);

    const meAfterLogout = await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie);
    expect(meAfterLogout.status).toBe(401);
  });
});
