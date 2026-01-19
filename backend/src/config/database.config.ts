import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  postgres: {
    url: process.env.DATABASE_URL,
  },
  mongodb: {
    uri: process.env.MONGODB_URI,
  },
}));
