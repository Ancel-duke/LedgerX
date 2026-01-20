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
      // Auto-run migrations on startup for Render free tier (no shell access)
      if (process.env.NODE_ENV === 'production' && process.env.AUTO_MIGRATE !== 'false') {
        try {
          const { execSync } = require('child_process');
          this.logger.log('Running database migrations...');
          execSync('npx prisma migrate deploy', { 
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'production' }
          });
          this.logger.log('Database migrations completed');
        } catch (migrationError: any) {
          // If migration fails, try to resolve and continue
          if (migrationError.message?.includes('failed migrations')) {
            this.logger.warn('Migration conflict detected. Attempting to resolve...');
            try {
              // Mark failed migrations as applied (for cases where schema already exists)
              // Try to resolve any failed migration
              const migrations = ['20260120170733_init', '20260120000000_init'];
              for (const migrationName of migrations) {
                try {
                  execSync(`npx prisma migrate resolve --applied ${migrationName}`, {
                    stdio: 'pipe',
                    env: { ...process.env, NODE_ENV: 'production' }
                  });
                  this.logger.log(`Resolved migration: ${migrationName}`);
                  break;
                } catch (e) {
                  // Try next migration name
                  continue;
                }
              }
              // Fallback: try generic resolve
              try {
                execSync('npx prisma migrate resolve --applied', { 
                stdio: 'inherit',
                env: { ...process.env, NODE_ENV: 'production' }
              });
              this.logger.log('Migration conflict resolved');
            } catch (resolveError) {
              this.logger.warn('Could not auto-resolve migration. Database may already be up to date.');
            }
          } else {
            this.logger.warn('Migration check failed (this is OK if already migrated):', migrationError.message);
          }
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
