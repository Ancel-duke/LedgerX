import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * E2E smoke: health, auth login, create invoice, create payment (internal API, no Stripe SDK).
 * Uses real app and test DB (DATABASE_URL). Run after test:reset-db for repeatable runs.
 */
describe('Smoke (e2e)', () => {
  let app: INestApplication;
  const ts = Date.now();
  const email = `e2e-smoke-${ts}@example.com`;
  const password = 'password123';
  const orgName = `E2E Smoke Org ${ts}`;
  let accessToken: string;
  let clientId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
      });
  });

  it('POST /auth/register creates user and org', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        firstName: 'E2E',
        lastName: 'Smoke',
        organizationName: orgName,
      })
      .expect(201)
      .expect((res) => {
        const data = res.body?.data ?? res.body;
        expect(data).toHaveProperty('accessToken');
        expect(data).toHaveProperty('user');
        accessToken = data.accessToken;
      });
  });

  it('POST /auth/login returns tokens', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200)
      .expect((res) => {
        const data = res.body?.data ?? res.body;
        expect(data).toHaveProperty('accessToken');
        accessToken = data.accessToken;
      });
  });

  it('POST /clients creates client', () => {
    return request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'E2E Smoke Client' })
      .expect(201)
      .expect((res) => {
        const data = res.body?.data ?? res.body;
        expect(data).toHaveProperty('id');
        clientId = data.id;
      });
  });

  it('POST /invoices creates invoice', () => {
    const issueDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return request(app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        clientId,
        issueDate,
        dueDate,
        items: [{ description: 'E2E item', quantity: 1, unitPrice: 100 }],
      })
      .expect(201)
      .expect((res) => {
        const data = res.body?.data ?? res.body;
        expect(data).toHaveProperty('id');
        invoiceId = data.id;
      });
  });

  it('POST /payments creates payment (internal)', () => {
    return request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        ...(invoiceId ? { invoiceId } : {}),
        amount: 50,
        method: 'CASH',
      })
      .expect(201)
      .expect((res) => {
        const data = res.body?.data ?? res.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('amount', 50);
      });
  });
});
