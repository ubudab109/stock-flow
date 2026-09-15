import type { StringValue } from 'ms';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  /** e.g. "7d" — validated as a real `ms`-parseable string by env.validation.ts. */
  jwtExpiresIn: StringValue;
  taxRateBps: number;
  webOrigin: string;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as StringValue,
  taxRateBps: Number(process.env.TAX_RATE_BPS ?? 1100),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
});
