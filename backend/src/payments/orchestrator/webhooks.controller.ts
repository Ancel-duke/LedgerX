import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { PaymentProvider } from '@prisma/client';

/**
 * Webhook endpoints for external payment providers. No JWT; verification is
 * via adapter signature and timestamp tolerance. Raw body required for signature verification.
 */
@Controller('payments/webhooks')
export class WebhooksController {
  constructor(private readonly orchestrator: PaymentOrchestratorService) {}

  @Post('mpesa')
  @HttpCode(HttpStatus.OK)
  async mpesa(@Req() req: Request, @Headers() headers: Record<string, string>) {
    const rawBody = this.getRawBody(req);
    try {
      return await this.orchestrator.handleWebhook(
        PaymentProvider.MPESA,
        rawBody,
        headers as Record<string, string>,
      );
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException((err as Error).message);
    }
  }

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async stripe(@Req() req: Request, @Headers() headers: Record<string, string>) {
    const rawBody = this.getRawBody(req);
    try {
      return await this.orchestrator.handleWebhook(
        PaymentProvider.STRIPE,
        rawBody,
        headers as Record<string, string>,
      );
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException((err as Error).message);
    }
  }

  private getRawBody(req: Request): Buffer {
    const body = req.body;
    if (Buffer.isBuffer(body)) {
      return body;
    }
    if (typeof body === 'string') {
      return Buffer.from(body, 'utf8');
    }
    throw new BadRequestException('Raw body required for webhook signature verification');
  }
}
