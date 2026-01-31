import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  provider: process.env.EMAIL_PROVIDER || 'smtp',
  from: process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@ledgerx.local',
  resetBaseUrl: process.env.RESET_BASE_URL || process.env.PASSWORD_RESET_BASE_URL || 'http://localhost:3001',
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
  },
}));
