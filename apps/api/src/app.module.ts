import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import configuration from './config/configuration.js';
import { validateEnv } from './config/env.validation.js';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProductsModule } from './products/products.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';

// The whole project shares one .env at the monorepo root (see .env.example
// there) instead of a separate one per app — this file lives at
// apps/api/src (or apps/api/dist once built), so the root is 3 levels up.
const rootEnvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: rootEnvPath,
      load: [configuration],
      validate: validateEnv,
    }),
    // Generous global default (every endpoint gets basic abuse protection);
    // /auth/login overrides this with a much stricter limit — see
    // auth.controller.ts.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
      errorMessage: 'Too many requests. Please try again later.',
    }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    InvoicesModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
