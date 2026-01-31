import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

/**
 * Health endpoints for Render and load balancers.
 * No auth; used for liveness and readiness.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness: process is running. */
  @Get()
  check() {
    return this.healthService.liveness();
  }

  /** Readiness: app and dependencies (e.g. DB) are ready. */
  @Get('ready')
  ready() {
    return this.healthService.readiness();
  }
}
