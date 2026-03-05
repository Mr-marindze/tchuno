import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
};

type SessionListResponse = {
  data: Array<{
    id: string;
    deviceId: string;
    revokedAt: string | null;
  }>;
  meta: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    pageCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

type CategoryPayload = {
  id: string;
  name: string;
  slug: string;
};

type WorkerProfilePayload = {
  id: string;
  userId: string;
  ratingAvg: string;
  ratingCount: number;
};

type JobPayload = {
  id: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
};

type ReviewPayload = {
  id: string;
  jobId: string;
  workerProfileId: string;
  reviewerId: string;
  rating: number;
};

describe('Auth and Sessions (e2e)', () => {
  let app: INestApplication<App>;

  const rootDir = resolve(__dirname, '../../..');
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const schemaName = `e2e_${Date.now()}_${randomUUID().slice(0, 8)}`;

  if (!originalDatabaseUrl) {
    throw new Error('DATABASE_URL must be defined for e2e tests');
  }

  const databaseUrl = new URL(originalDatabaseUrl);
  databaseUrl.searchParams.set('schema', schemaName);
  const e2eDatabaseUrl = databaseUrl.toString();
  const adminDatabaseUrl = new URL(originalDatabaseUrl);
  adminDatabaseUrl.searchParams.delete('schema');
  const adminConnectionUrl = adminDatabaseUrl.toString();

  beforeAll(async () => {
    process.env.DATABASE_URL = e2eDatabaseUrl;

    execSync('yarn workspace @tchuno/database prisma migrate deploy', {
      cwd: rootDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: e2eDatabaseUrl,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        stopAtFirstError: true,
        transform: true,
      }),
    );
    await app.init();
  }, 120_000);

  afterAll(async () => {
    try {
      await app.close();
    } finally {
      const prismaAdmin = new PrismaClient({
        datasources: {
          db: {
            url: adminConnectionUrl,
          },
        },
      });

      await prismaAdmin.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
      );
      await prismaAdmin.$disconnect();

      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('register/login/refresh/sessions/revoke/logout/logout-all happy path', async () => {
    const email = `e2e_${Date.now()}@tchuno.local`;
    const password = 'abc12345';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .set('x-device-id', 'e2e-device-a')
      .send({ email, password, name: 'E2E User' })
      .expect(201);
    const registerBody = registerResponse.body as AuthPayload;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-device-id', 'e2e-device-b')
      .send({ email, password })
      .expect(200);
    const loginBody = loginResponse.body as AuthPayload;

    const rotatedResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('x-device-id', 'e2e-device-a')
      .send({ refreshToken: registerBody.refreshToken })
      .expect(200);
    const rotatedBody = rotatedResponse.body as AuthPayload;

    const sessionsResponse = await request(app.getHttpServer())
      .get('/auth/sessions?status=all&limit=1&offset=0&sort=lastUsedAt:desc')
      .set('Authorization', `Bearer ${rotatedBody.accessToken}`)
      .expect(200);
    const sessionsBody = sessionsResponse.body as SessionListResponse;

    expect(Array.isArray(sessionsBody.data)).toBe(true);
    expect(sessionsBody.meta.total).toBeGreaterThanOrEqual(2);
    expect(sessionsBody.meta.limit).toBe(1);
    expect(sessionsBody.meta.offset).toBe(0);
    expect(sessionsBody.meta.page).toBe(1);
    expect(sessionsBody.meta.pageCount).toBeGreaterThanOrEqual(2);
    expect(sessionsBody.meta.hasNext).toBe(true);
    expect(sessionsBody.meta.hasPrev).toBe(false);

    const sessionsAllResponse = await request(app.getHttpServer())
      .get('/auth/sessions?status=all&limit=20&offset=0&sort=lastUsedAt:desc')
      .set('Authorization', `Bearer ${rotatedBody.accessToken}`)
      .expect(200);
    const sessionsAllBody = sessionsAllResponse.body as SessionListResponse;

    const deviceBSession = sessionsAllBody.data.find(
      (item) => item.deviceId === 'e2e-device-b',
    );

    expect(deviceBSession).toBeDefined();
    if (!deviceBSession) {
      throw new Error('Expected a session for e2e-device-b');
    }

    await request(app.getHttpServer())
      .delete(`/auth/sessions/${deviceBSession.id}`)
      .set('Authorization', `Bearer ${rotatedBody.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: loginBody.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: rotatedBody.refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${rotatedBody.accessToken}`)
      .send({})
      .expect(204);
  });

  it('rejects invalid credentials and invalid refresh token', async () => {
    const email = `invalid_${Date.now()}@tchuno.local`;
    const password = 'abc12345';

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Invalid User' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong1234' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'not-a-jwt' })
      .expect(400);
  });

  it('rejects protected routes without access token (RBAC)', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer()).get('/auth/sessions').expect(401);
    await request(app.getHttpServer())
      .post('/auth/logout-all')
      .send({})
      .expect(401);
  });

  it('does not allow user A to revoke user B session', async () => {
    const userAEmail = `user_a_${Date.now()}@tchuno.local`;
    const userBEmail = `user_b_${Date.now()}@tchuno.local`;
    const password = 'abc12345';

    const userARegister = await request(app.getHttpServer())
      .post('/auth/register')
      .set('x-device-id', 'rbac-device-a')
      .send({ email: userAEmail, password, name: 'User A' })
      .expect(201);
    const userA = userARegister.body as AuthPayload;

    const userBRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .set('x-device-id', 'rbac-device-b')
      .send({ email: userBEmail, password, name: 'User B' })
      .expect(201);
    const userB = userBRegister.body as AuthPayload;

    const userBSessionsResponse = await request(app.getHttpServer())
      .get('/auth/sessions?status=active&limit=20&offset=0')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(200);
    const userBSessionsBody = userBSessionsResponse.body as SessionListResponse;

    const userBSession = userBSessionsBody.data.find(
      (session) => session.deviceId === 'rbac-device-b',
    );

    expect(userBSession).toBeDefined();
    if (!userBSession) {
      throw new Error('Expected user B active session');
    }

    await request(app.getHttpServer())
      .delete(`/auth/sessions/${userBSession.id}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: userB.refreshToken })
      .expect(200);
  });

  it('detects refresh token reuse and revokes token chain', async () => {
    const email = `reuse_${Date.now()}@tchuno.local`;
    const password = 'abc12345';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .set('x-device-id', 'reuse-device')
      .send({ email, password, name: 'Reuse User' })
      .expect(201);
    const registerBody = registerResponse.body as AuthPayload;

    const firstRefreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('x-device-id', 'reuse-device')
      .send({ refreshToken: registerBody.refreshToken })
      .expect(200);
    const firstRefreshBody = firstRefreshResponse.body as AuthPayload;

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('x-device-id', 'reuse-device')
      .send({ refreshToken: registerBody.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('x-device-id', 'reuse-device')
      .send({ refreshToken: firstRefreshBody.refreshToken })
      .expect(401);
  });

  it('client -> worker -> job status -> review flow', async () => {
    const workerEmail = `flow_worker_${Date.now()}@tchuno.local`;
    const clientEmail = `flow_client_${Date.now()}@tchuno.local`;
    const password = 'abc12345';

    const workerRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: workerEmail, password, name: 'Flow Worker' })
      .expect(201);
    const workerAuth = workerRegister.body as AuthPayload;

    const clientRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: clientEmail, password, name: 'Flow Client' })
      .expect(201);
    const clientAuth = clientRegister.body as AuthPayload;

    const categoryResponse = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({
        name: `Ar Condicionado ${Date.now()}`,
        slug: `ar-condicionado-${Date.now()}`,
        description: 'Instalacao e manutencao de ar condicionado',
        sortOrder: 40,
      })
      .expect(201);
    const category = categoryResponse.body as CategoryPayload;

    const workerProfileResponse = await request(app.getHttpServer())
      .put('/worker-profile/me')
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({
        bio: 'Especialista em climatizacao',
        location: 'Maputo',
        hourlyRate: 1200,
        experienceYears: 7,
        isAvailable: true,
        categoryIds: [category.id],
      })
      .expect(200);
    const workerProfile = workerProfileResponse.body as WorkerProfilePayload;

    const createJobResponse = await request(app.getHttpServer())
      .post('/jobs')
      .set('Authorization', `Bearer ${clientAuth.accessToken}`)
      .send({
        workerProfileId: workerProfile.id,
        categoryId: category.id,
        title: 'Instalar AC no quarto',
        description:
          'Preciso instalar um AC split de 12k BTU ainda esta semana.',
        budget: 5000,
      })
      .expect(201);
    const job = createJobResponse.body as JobPayload;

    const workerJobsResponse = await request(app.getHttpServer())
      .get('/jobs/me/worker')
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .expect(200);
    const workerJobs = workerJobsResponse.body as JobPayload[];
    expect(workerJobs.some((item) => item.id === job.id)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/jobs/${job.id}/status`)
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/jobs/${job.id}/status`)
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/jobs/${job.id}/status`)
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({ status: 'COMPLETED' })
      .expect(200);

    const reviewResponse = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${clientAuth.accessToken}`)
      .send({
        jobId: job.id,
        rating: 5,
        comment: 'Servico excelente, dentro do prazo.',
      })
      .expect(201);
    const review = reviewResponse.body as ReviewPayload;
    expect(review.jobId).toBe(job.id);
    expect(review.rating).toBe(5);

    const workerProfilePublicResponse = await request(app.getHttpServer())
      .get(`/worker-profile/${workerAuth.user.id}`)
      .expect(200);
    const workerProfilePublic =
      workerProfilePublicResponse.body as WorkerProfilePayload;
    expect(workerProfilePublic.ratingCount).toBe(1);
    expect(Number.parseFloat(workerProfilePublic.ratingAvg)).toBeCloseTo(5, 2);

    const workerReviewsResponse = await request(app.getHttpServer())
      .get(`/reviews/worker/${workerProfile.id}`)
      .expect(200);
    const workerReviews = workerReviewsResponse.body as ReviewPayload[];
    expect(workerReviews.length).toBeGreaterThanOrEqual(1);
    expect(workerReviews[0]?.jobId).toBe(job.id);
  });

  it('rate-limits repeated login attempts', async () => {
    const email = `limit_${Date.now()}@tchuno.local`;
    const password = 'abc12345';

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Rate Limit User' })
      .expect(201);

    let received429 = false;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong1234' });

      if (response.status === 429) {
        received429 = true;
        break;
      }
    }

    expect(received429).toBe(true);
  });
});
