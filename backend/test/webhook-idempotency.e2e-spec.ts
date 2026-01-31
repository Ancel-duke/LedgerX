import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import * as express from 'express';
import Stripe from 'stripe';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/postgres/prisma.service';
import { LedgerBootstrapService } from '../src/ledger/ledger-bootstrap.service';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_e2e';
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
}

/**
 * E2E: Webhook idempotency. Same payload sent twice returns same result and idempotent: true on second.
 * Uses real test database and real Stripe signature (generateTestHeaderString).
 */
describe('Webhook idempotency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ledgerBootstrap: LedgerBootstrapService;
  let orgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const configService = app.get(ConfigService);
    const apiPrefix = configService.get<string>('app.apiPrefix') || 'api';

    const httpAdapter = app.getHttpAdapter();
    const expressApp = httpAdapter.getInstance();
    expressApp.use(
      `/${apiPrefix}/payments/webhooks`,
      express.raw({ type: 'application/json' }),
    );
    app.setGlobalPrefix(apiPrefix, {
      exclude: ['health', 'health/(.*)', 'metrics'],
    });

    await app.init();

    prisma = moduleFixture.get(PrismaService);
    ledgerBootstrap = moduleFixture.get(LedgerBootstrapService);

    const org = await prisma.organization.create({
      data: { name: 'E2E Webhook Org', slug: `e2e-webhook-${Date.now()}` },
    });
    orgId = org.id;
    await ledgerBootstrap.ensureDefaults(orgId);
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.paymentIntent.deleteMany({ where: { organizationId: orgId } });
      await prisma.payment.deleteMany({ where: { organizationId: orgId } });
      await prisma.ledgerTransaction.deleteMany({ where: { organizationId: orgId } });
      await prisma.ledgerAccount.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await app.close();
  });

  it('second webhook call with same providerRef returns idempotent and same paymentId', async () => {
    const providerRef = `pi_e2e_${Date.now()}`;
    const payload = {
      id: `evt_${Date.now()}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: providerRef,
          amount: 2000,
          currency: 'usd',
          metadata: { organizationId: orgId },
        },
      },
    };
    const body = JSON.stringify(payload);
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: webhookSecret,
    });

    const server = app.getHttpServer();
    const first = await request(server)
      .post('/api/payments/webhooks/stripe')
      .set('Stripe-Signature', signature)
      .set('Content-Type', 'application/json')
      .send(Buffer.from(body, 'utf8'))
      .expect(200);

    const second = await request(server)
      .post('/api/payments/webhooks/stripe')
      .set('Stripe-Signature', signature)
      .set('Content-Type', 'application/json')
      .send(Buffer.from(body, 'utf8'))
      .expect(200);

    expect(second.body.idempotent).toBe(true);
    expect(second.body.paymentId).toBe(first.body.paymentId);
    expect(second.body.paymentIntentId).toBe(first.body.paymentIntentId);
  });
});
