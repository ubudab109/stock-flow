import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// This import resolves once `pretest:e2e` (prisma/setup-test-db.ts) has
// generated the SQLite-flavored client — see that script for why tests run
// against SQLite instead of the real Postgres used in dev/prod.
import { PrismaClient } from '../../src/generated/prisma-test/client.js';

const dbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../prisma/test.db');

@Injectable()
export class TestPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaBetterSqlite3({ url: `file:${dbPath}` }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
