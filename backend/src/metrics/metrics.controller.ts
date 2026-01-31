import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';

/**
 * Prometheus scrape endpoint. No auth; typically secured by network.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async metrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
