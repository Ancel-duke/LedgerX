import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  
  DATABASE_URL: Joi.string().required(),
  MONGODB_URI: Joi.string().required(),
  
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
  
  CORS_ORIGIN: Joi.string().default('http://localhost:3001'),

  EMAIL_PROVIDER: Joi.string().valid('sendgrid', 'smtp').optional(),
  FROM_EMAIL: Joi.string().email().optional(),
  RESET_BASE_URL: Joi.string().uri().optional(),
  SENDGRID_API_KEY: Joi.string().optional(),
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().optional(),
  SMTP_SECURE: Joi.string().valid('true', 'false').optional(),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),

  MPESA_API_BASE_URL: Joi.string().uri().optional(),
  MPESA_CONSUMER_KEY: Joi.string().optional(),
  MPESA_CONSUMER_SECRET: Joi.string().optional(),
  MPESA_SHORTCODE: Joi.string().optional(),
  MPESA_PASSKEY: Joi.string().optional(),
  MPESA_CALLBACK_URL: Joi.string().uri().optional(),
  MPESA_STK_PUSH_TIMEOUT_MS: Joi.number().optional(),

  DIAGNOSTICS_CRON: Joi.string().optional(),
  DIAGNOSTICS_RETENTION_DAYS: Joi.number().optional(),
  DIAGNOSTICS_AI_ENABLED: Joi.string().valid('true', 'false').optional(),
  OPENAI_API_KEY: Joi.string().optional(),
  DIAGNOSTICS_LLM_MODEL: Joi.string().optional(),
  DIAGNOSTICS_LLM_TIMEOUT_MS: Joi.number().optional(),

  REDIS_URL: Joi.string().uri().optional(),
  AUDIT_RETENTION_DAYS: Joi.number().optional(),
  AUDIT_CLEANUP_CRON: Joi.string().optional(),
  FRAUD_AGGREGATION_CRON: Joi.string().optional(),

  RENDER_DEPLOY_HOOK_URL: Joi.string().uri().optional(),
  DEPLOY_HOOK_URL: Joi.string().uri().optional(),
  RESTART_EXIT_CODE: Joi.number().optional(),
});
