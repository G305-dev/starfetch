import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('Phase 2A foundation (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns a safe ok envelope', async () => {
    const res = await request(server).get('/api/v1/health').expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.version).toBe('string');
    expect(res.body.meta.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body.error).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/DATABASE_URL|password|secret|stack|postgres/i);
  });

  it('unknown routes return a safe NOT_FOUND error with a request ID', async () => {
    const res = await request(server).get('/api/v1/definitely-not-a-route').expect(404);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at Object|\\\/home\\\//i);
  });

  it('honours a safe client-supplied x-request-id and echoes it back', async () => {
    const res = await request(server)
      .get('/api/v1/health')
      .set('x-request-id', 'phase2a-check-001')
      .expect(200);

    expect(res.headers['x-request-id']).toBe('phase2a-check-001');
    expect(res.body.meta.requestId).toBe('phase2a-check-001');
  });

  it('unsupported methods fall into the same safe error envelope', async () => {
    const res = await request(server).post('/api/v1/health').send({}).expect(404);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeDefined();
  });

  it('GET / returns a safe 404 that still carries a request ID everywhere', async () => {
    const res = await request(server).get('/').expect(404);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeDefined();
    expect(res.body.error.requestId).not.toBe('unavailable');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toBe(res.body.error.requestId);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at Object|\\\/home\\\//i);
  });

  it('rejects junk x-request-id values and generates a safe one', async () => {
    const res = await request(server)
      .get('/api/v1/health')
      .set('x-request-id', '  <script>alert(1)</script>  ')
      .expect(200);

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).not.toContain('<script>');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
