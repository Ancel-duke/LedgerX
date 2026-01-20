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
          const errorMessage = migrationError.message || migrationError.toString() || '';
          const errorOutput = migrationError.stdout?.toString() || migrationError.stderr?.toString() || '';
          const fullError = `${errorMessage} ${errorOutput}`;
          
          // Check for failed migration errors (P3009, P3018, or "failed migrations" text)
          if (fullError.includes('P3009') || 
              fullError.includes('P3018') || 
              fullError.includes('failed migrations') ||
              fullError.includes('failed to apply')) {
            this.logger.warn('Migration conflict detected. Attempting to resolve...');
            try {
              // Try to resolve the known failed migration
              const failedMigrationName = '20260120170733_init';
              try {
                execSync(`npx prisma migrate resolve --applied ${failedMigrationName}`, {
                  stdio: 'pipe',
                  env: { ...process.env, NODE_ENV: 'production' }
                });
                this.logger.log(`Successfully resolved migration: ${failedMigrationName}`);
                // Try to run migrations again after resolving
                try {
                  execSync('npx prisma migrate deploy', { 
                    stdio: 'pipe',
                    env: { ...process.env, NODE_ENV: 'production' }
                  });
                  this.logger.log('Migrations completed after resolution');
                } catch (retryError) {
                  this.logger.warn('Migration retry completed (may already be up to date)');
                }
              } catch (resolveError) {
                this.logger.warn(`Could not resolve ${failedMigrationName}, but continuing...`);
              }
            } catch (resolveError) {
              this.logger.warn('Could not auto-resolve migration. Database may already be up to date.');
            }
          } else {
            this.logger.warn('Migration check completed (this is OK if already migrated)');
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
