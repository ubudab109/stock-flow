// Test env config lives here as plain code, not a `.env.test` file to copy —
// there's nothing environment-specific to configure. Tests run against a
// disposable local SQLite database (test-prisma.service.ts), so DATABASE_URL
// below is never actually connected to; it only needs to look like a real
// Postgres URL to satisfy env validation on boot (src/config/env.validation.ts).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused';
process.env.JWT_SECRET ??= 'test-only-secret-not-for-real-use';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.TAX_RATE_BPS ??= '1100';
process.env.WEB_ORIGIN ??= 'http://localhost:5173';
