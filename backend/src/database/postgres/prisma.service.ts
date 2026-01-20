import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    try {
      // Run migrations automatically on startup (for Render free tier without shell access)
      if (process.env.NODE_ENV === 'production') {
        try {
          const { execSync } = require('child_process');
          this.logger.log('Running database migrations...');
          execSync('npx prisma migrate deploy', { stdio: 'inherit' });
          this.logger.log('Database migrations completed');
        } catch (migrationError) {
          // If migrations fail, log but don't crash (might already be up to date)
          this.logger.warn('Migration check failed (this is OK if already migrated):', migrationError);
        }
      }

      await this.$connect();
      this.logger.log('PostgreSQL database connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('PostgreSQL database disconnected');
  }
}
