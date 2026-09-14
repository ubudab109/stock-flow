import Joi from 'joi';

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  TAX_RATE_BPS: Joi.number().integer().min(0).max(10000).default(1100),
  WEB_ORIGIN: Joi.string().uri().default('http://localhost:5173'),
}).unknown(true);

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = schema.validate(config, { abortEarly: false });
  if (error) {
    throw new Error(`Invalid environment configuration:\n${error.message}`);
  }
  return value as Record<string, unknown>;
}
