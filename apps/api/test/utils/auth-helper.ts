import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** Registers a fresh user and returns the login `Set-Cookie` header for use in subsequent requests. */
export async function registerAndLogin(
  app: INestApplication,
  email: string,
  password = 'Passw0rd!',
): Promise<string> {
  await request(app.getHttpServer()).post('/auth/register').send({ email, password }).expect(201);
  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  return loginResponse.headers['set-cookie'];
}
