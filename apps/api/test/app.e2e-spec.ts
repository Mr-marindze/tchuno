import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

type PaginatedResponse<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  };
};

type TrackingWorkerRankingResponse = {
  data: Array<{
    workerProfileId: string;
    score: number;
    clicks: number;
    ctaClicks: number;
    conversions: number;
    isAvailable: boolean;
  }>;
  meta: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  };
};

describe('Auth and Sessions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

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

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: e2eDatabaseUrl,
        },
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
      await prisma.$disconnect();
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
    await request(app.getHttpServer()).get('/admin/ops/overview').expect(401);
  });

  it('allows admin-only access to admin ops overview', async () => {
    const userEmail = `admin_ops_user_${Date.now()}@tchuno.local`;
    const adminEmail = `admin_ops_admin_${Date.now()}@tchuno.local`;
    const jwtService = app.get(JwtService);

    const regularUser = await prisma.user.create({
      data: {
        email: userEmail,
        name: 'Regular User',
        passwordHash: 'e2e-placeholder-hash',
        role: 'USER',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
      },
    });

    const regularToken = jwtService.sign(
      {
        sub: regularUser.id,
        email: regularUser.email,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET || 'change-me-access',
        expiresIn: '15m',
      },
    );

    await request(app.getHttpServer())
      .get('/admin/ops/overview')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(403);

    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin Ops User',
        passwordHash: 'e2e-placeholder-hash',
        role: 'ADMIN',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
      },
    });

    const adminToken = jwtService.sign(
      {
        sub: adminUser.id,
        email: adminUser.email,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET || 'change-me-access',
        expiresIn: '15m',
      },
    );

    const overviewResponse = await request(app.getHttpServer())
      .get('/admin/ops/overview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const overview = overviewResponse.body as {
      kpis: {
        totalJobs: number;
        jobsByStatus: {
          REQUESTED: number;
          ACCEPTED: number;
          IN_PROGRESS: number;
          COMPLETED: number;
          CANCELED: number;
        };
        completionRate: number;
        totalReviews: number;
        averageRating: number;
        activePublicableWorkers: number;
        jobsByPricingMode: {
          FIXED_PRICE: number;
          QUOTE_REQUEST: number;
        };
      };
      recentJobs: Array<{ id: string; status: string }>;
      recentlyCanceledJobs: Array<{ id: string; status: string }>;
      completedWithoutReviewJobs: Array<{ id: string; status: string }>;
    };

    expect(typeof overview.kpis.totalJobs).toBe('number');
    expect(typeof overview.kpis.totalReviews).toBe('number');
    expect(typeof overview.kpis.jobsByStatus.REQUESTED).toBe('number');
    expect(typeof overview.kpis.jobsByPricingMode.FIXED_PRICE).toBe('number');
    expect(Array.isArray(overview.recentJobs)).toBe(true);
    expect(Array.isArray(overview.recentlyCanceledJobs)).toBe(true);
    expect(Array.isArray(overview.completedWithoutReviewJobs)).toBe(true);
  });

  it('ingests tracking events and exposes shared worker ranking', async () => {
    const workerAEmail = `tracking_worker_a_${Date.now()}@tchuno.local`;
    const workerBEmail = `tracking_worker_b_${Date.now()}@tchuno.local`;

    const [workerAUser, workerBUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: workerAEmail,
          name: 'Tracking Worker A',
          passwordHash: 'e2e-placeholder-hash',
          role: 'USER',
          isActive: true,
        },
        select: {
          id: true,
        },
      }),
      prisma.user.create({
        data: {
          email: workerBEmail,
          name: 'Tracking Worker B',
          passwordHash: 'e2e-placeholder-hash',
          role: 'USER',
          isActive: true,
        },
        select: {
          id: true,
        },
      }),
    ]);

    const [workerA, workerB] = await Promise.all([
      prisma.workerProfile.create({
        data: {
          userId: workerAUser.id,
          location: 'Maputo',
          experienceYears: 6,
          isAvailable: true,
          ratingAvg: 4.8,
          ratingCount: 12,
        },
        select: {
          id: true,
        },
      }),
      prisma.workerProfile.create({
        data: {
          userId: workerBUser.id,
          location: 'Matola',
          experienceYears: 3,
          isAvailable: false,
          ratingAvg: 4.5,
          ratingCount: 5,
        },
        select: {
          id: true,
        },
      }),
    ]);

    const baseTimestamp = new Date().toISOString();

    await request(app.getHttpServer())
      .post('/tracking/events')
      .send({
        sessionId: `sess_${Date.now()}`,
        sentAt: baseTimestamp,
        events: [
          {
            name: 'marketplace.worker.card.click',
            timestamp: baseTimestamp,
            metadata: {
              workerId: workerA.id,
              source: 'landing.worker_card',
            },
          },
          {
            name: 'marketplace.worker.card.click',
            timestamp: baseTimestamp,
            metadata: {
              workerId: workerA.id,
              source: 'landing.worker_card',
            },
          },
          {
            name: 'marketplace.cta.click',
            timestamp: baseTimestamp,
            metadata: {
              workerId: workerA.id,
              source: 'landing.worker_card',
            },
          },
          {
            name: 'job.create.submit',
            timestamp: baseTimestamp,
            metadata: {
              workerProfileId: workerA.id,
              source: 'dashboard.jobs.create',
            },
          },
          {
            name: 'marketplace.worker.card.click',
            timestamp: baseTimestamp,
            metadata: {
              workerId: workerB.id,
              source: 'landing.worker_card',
            },
          },
          {
            name: 'marketplace.category.select',
            timestamp: baseTimestamp,
            metadata: {
              categorySlug: 'canalizacao',
              source: 'landing.discovery',
            },
          },
        ],
      })
      .expect(201);

    let rankedWithUnavailable: TrackingWorkerRankingResponse | null = null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get(
          '/tracking/ranking/workers?page=1&limit=20&includeUnavailable=true',
        )
        .expect(200);

      const body = response.body as TrackingWorkerRankingResponse;
      const hasWorkerA = body.data.some(
        (item) => item.workerProfileId === workerA.id,
      );

      if (hasWorkerA) {
        rankedWithUnavailable = body;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    expect(rankedWithUnavailable).not.toBeNull();
    if (!rankedWithUnavailable) {
      throw new Error('Expected shared ranking to include worker A');
    }

    expect(rankedWithUnavailable.meta.page).toBe(1);
    expect(rankedWithUnavailable.meta.limit).toBe(20);

    const rankedWorkerA = rankedWithUnavailable.data.find(
      (item) => item.workerProfileId === workerA.id,
    );
    const rankedWorkerB = rankedWithUnavailable.data.find(
      (item) => item.workerProfileId === workerB.id,
    );

    expect(rankedWorkerA).toBeDefined();
    expect(rankedWorkerB).toBeDefined();

    if (!rankedWorkerA || !rankedWorkerB) {
      throw new Error('Expected both worker profiles in shared ranking');
    }

    expect(rankedWorkerA.conversions).toBeGreaterThanOrEqual(1);
    expect(rankedWorkerA.score).toBeGreaterThan(rankedWorkerB.score);

    const availableOnlyResponse = await request(app.getHttpServer())
      .get('/tracking/ranking/workers?page=1&limit=20')
      .expect(200);

    const availableOnly =
      availableOnlyResponse.body as TrackingWorkerRankingResponse;
    expect(
      availableOnly.data.some((item) => item.workerProfileId === workerB.id),
    ).toBe(false);
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

    const category = (await prisma.category.create({
      data: {
        name: `Ar Condicionado ${Date.now()}`,
        slug: `ar-condicionado-${Date.now()}`,
        description: 'Instalacao e manutencao de ar condicionado',
        sortOrder: 40,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    })) as CategoryPayload;

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
    const workerJobs = workerJobsResponse.body as PaginatedResponse<JobPayload>;
    expect(workerJobs.data.some((item) => item.id === job.id)).toBe(true);

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
    const workerReviews =
      workerReviewsResponse.body as PaginatedResponse<ReviewPayload>;
    expect(workerReviews.data.length).toBeGreaterThanOrEqual(1);
    expect(workerReviews.data[0]?.jobId).toBe(job.id);
    const createQuoteJobResponse = await request(app.getHttpServer())
      .post('/jobs')
      .set('Authorization', `Bearer ${clientAuth.accessToken}`)
      .send({
        workerProfileId: workerProfile.id,
        categoryId: category.id,
        pricingMode: 'QUOTE_REQUEST',
        title: 'Diagnostico de fuga de agua',
        description: 'Preciso de visita tecnica e proposta para reparacao.',
      })
      .expect(201);

    const quoteJob = createQuoteJobResponse.body as JobPayload & {
      pricingMode: 'FIXED_PRICE' | 'QUOTE_REQUEST';
    };
    expect(quoteJob.pricingMode).toBe('QUOTE_REQUEST');

    await request(app.getHttpServer())
      .patch(`/jobs/${quoteJob.id}/status`)
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/jobs/${quoteJob.id}/status`)
      .set('Authorization', `Bearer ${clientAuth.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(400);

    const proposedQuoteResponse = await request(app.getHttpServer())
      .patch(`/jobs/${quoteJob.id}/quote`)
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({
        quotedAmount: 4500,
        quoteMessage: 'Inclui material e deslocacao',
      })
      .expect(200);

    const proposedQuote = proposedQuoteResponse.body as JobPayload & {
      quotedAmount: number | null;
      quoteMessage: string | null;
    };
    expect(proposedQuote.quotedAmount).toBe(4500);
    expect(proposedQuote.quoteMessage).toBe('Inclui material e deslocacao');

    const clientJobsResponse = await request(app.getHttpServer())
      .get('/jobs/me/client?status=REQUESTED&page=1&limit=10')
      .set('Authorization', `Bearer ${clientAuth.accessToken}`)
      .expect(200);
    const clientJobs = clientJobsResponse.body as PaginatedResponse<
      JobPayload & { quotedAmount: number | null }
    >;
    const quoteJobInList = clientJobs.data.find(
      (item) => item.id === quoteJob.id,
    );
    expect(quoteJobInList?.quotedAmount).toBe(4500);

    await request(app.getHttpServer())
      .patch(`/jobs/${quoteJob.id}/status`)
      .set('Authorization', `Bearer ${clientAuth.accessToken}`)
      .send({ status: 'ACCEPTED', quotedAmount: 4500 })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/jobs/${quoteJob.id}/status`)
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/jobs/${quoteJob.id}/status`)
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({ status: 'COMPLETED' })
      .expect(200);
  });

  it('chaos flow: rejects invalid actions and handles multi-session revocation', async () => {
    const workerEmail = `chaos_worker_${Date.now()}@tchuno.local`;
    const clientEmail = `chaos_client_${Date.now()}@tchuno.local`;
    const password = 'abc12345';

    const workerRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .set('x-device-id', 'chaos-worker-device')
      .send({ email: workerEmail, password, name: 'Chaos Worker' })
      .expect(201);
    const workerAuth = workerRegister.body as AuthPayload;

    await request(app.getHttpServer())
      .get('/jobs/me/worker')
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .expect(404);

    const clientRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .set('x-device-id', 'chaos-client-tab-a')
      .send({ email: clientEmail, password, name: 'Chaos Client' })
      .expect(201);
    const clientTabA = clientRegister.body as AuthPayload;

    const clientLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-device-id', 'chaos-client-tab-b')
      .send({ email: clientEmail, password })
      .expect(200);
    const clientTabB = clientLogin.body as AuthPayload;

    const jwtService = app.get(JwtService);
    const expiredRefreshToken = jwtService.sign(
      {
        sub: clientTabA.user.id,
        email: clientTabA.user.email,
        type: 'refresh',
        sid: randomUUID(),
        did: 'chaos-client-tab-a',
        jti: randomUUID(),
      },
      {
        secret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
        expiresIn: '-10s',
      },
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('x-device-id', 'chaos-client-tab-a')
      .send({ refreshToken: expiredRefreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({
        name: `Eletricista Chaos ${Date.now()}`,
        slug: `eletricista-chaos-${Date.now()}`,
        description: 'Servicos eletricos para QA de caos',
        sortOrder: 70,
      })
      .expect(403);

    const category = (await prisma.category.create({
      data: {
        name: `Eletricista Chaos ${Date.now()}`,
        slug: `eletricista-chaos-${Date.now()}`,
        description: 'Servicos eletricos para QA de caos',
        sortOrder: 70,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    })) as CategoryPayload;

    const workerProfileUnavailableResponse = await request(app.getHttpServer())
      .put('/worker-profile/me')
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({
        bio: 'Perfil criado para testes agressivos',
        location: 'Maputo',
        hourlyRate: 900,
        experienceYears: 5,
        isAvailable: false,
        categoryIds: [category.id],
      })
      .expect(200);
    const workerProfile =
      workerProfileUnavailableResponse.body as WorkerProfilePayload;

    await request(app.getHttpServer())
      .post('/jobs')
      .set('Authorization', `Bearer ${clientTabA.accessToken}`)
      .send({
        workerProfileId: workerProfile.id,
        categoryId: category.id,
        title: 'Serviço com worker indisponível',
        description: 'Este job deve falhar porque o worker está indisponível.',
        budget: 3500,
      })
      .expect(409);

    await request(app.getHttpServer())
      .patch('/worker-profile/me')
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({ isAvailable: true })
      .expect(200);

    await request(app.getHttpServer())
      .post('/jobs')
      .set('Authorization', `Bearer ${clientTabA.accessToken}`)
      .send({
        workerProfileId: workerProfile.id,
        categoryId: category.id,
        title: 'ab',
        description: 'curta',
        budget: -1,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/jobs')
      .set('Authorization', `Bearer ${clientTabA.accessToken}`)
      .send({
        workerProfileId: workerProfile.id,
        categoryId: category.id,
        title: 'Serviço agendado no passado',
        description:
          'Este job deve falhar porque foi agendado para uma data passada.',
        budget: 3500,
        scheduledFor: '2020-01-01T10:00:00.000Z',
      })
      .expect(400);

    await request(app.getHttpServer())
      .get('/worker-profile?categorySlug=@@slug-invalido')
      .expect(400);

    const createJobResponse = await request(app.getHttpServer())
      .post('/jobs')
      .set('Authorization', `Bearer ${clientTabA.accessToken}`)
      .send({
        workerProfileId: workerProfile.id,
        categoryId: category.id,
        title: 'Trocar quadro elétrico',
        description: 'Preciso trocar quadro elétrico e revisar disjuntores.',
        budget: 6000,
      })
      .expect(201);
    const job = createJobResponse.body as JobPayload;

    const activeSessionsResponse = await request(app.getHttpServer())
      .get('/auth/sessions?status=active&limit=10&offset=0&sort=createdAt:asc')
      .set('Authorization', `Bearer ${clientTabB.accessToken}`)
      .expect(200);
    const activeSessions = activeSessionsResponse.body as SessionListResponse;
    expect(activeSessions.meta.total).toBeGreaterThanOrEqual(2);

    await request(app.getHttpServer())
      .patch(`/jobs/${job.id}/status`)
      .set('Authorization', `Bearer ${clientTabA.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/jobs/${job.id}/status`)
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({ status: 'COMPLETED' })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/jobs/${job.id}/status`)
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/jobs/${job.id}/status`)
      .set('Authorization', `Bearer ${workerAuth.accessToken}`)
      .send({ status: 'COMPLETED' })
      .expect(409);

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

    await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${clientTabA.accessToken}`)
      .send({
        jobId: job.id,
        rating: 4,
        comment: 'Concluído com qualidade.',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${clientTabA.accessToken}`)
      .send({
        jobId: job.id,
        rating: 3,
        comment: 'Tentativa duplicada deve falhar.',
      })
      .expect(409);

    await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${clientTabA.accessToken}`)
      .send({})
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('x-device-id', 'chaos-client-tab-a')
      .send({ refreshToken: clientTabA.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('x-device-id', 'chaos-client-tab-b')
      .send({ refreshToken: clientTabB.refreshToken })
      .expect(401);

    const revokedSessionsResponse = await request(app.getHttpServer())
      .get(
        '/auth/sessions?status=revoked&limit=1&offset=0&sort=lastUsedAt:desc',
      )
      .set('Authorization', `Bearer ${clientTabA.accessToken}`)
      .expect(200);
    const revokedSessions = revokedSessionsResponse.body as SessionListResponse;

    expect(revokedSessions.meta.total).toBeGreaterThanOrEqual(2);
    expect(revokedSessions.meta.page).toBe(1);
    expect(revokedSessions.meta.hasPrev).toBe(false);
    expect(revokedSessions.meta.pageCount).toBeGreaterThanOrEqual(2);
    expect(revokedSessions.meta.hasNext).toBe(true);
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
