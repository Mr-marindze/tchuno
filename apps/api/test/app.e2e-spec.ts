import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

type AuthPayload = {
  accessToken: string;
  refreshToken: string;
};

type SessionItem = {
  id: string;
  deviceId: string;
};

describe('Auth and Sessions (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('register/login/refresh/sessions/logout/logout-all flow', async () => {
    const email = `e2e_${Date.now()}@tchuno.local`;
    const password = '12345678';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .set('x-device-id', 'e2e-device-a')
      .send({ email, password, name: 'E2E User' })
      .expect(201);
    const registerBody = registerResponse.body as AuthPayload;

    const firstRefreshToken = registerBody.refreshToken;
    const firstAccessToken = registerBody.accessToken;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-device-id', 'e2e-device-b')
      .send({ email, password })
      .expect(200);
    const loginBody = loginResponse.body as AuthPayload;

    const secondRefreshToken = loginBody.refreshToken;
    const secondAccessToken = loginBody.accessToken;

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('x-device-id', 'e2e-device-a')
      .send({ refreshToken: firstRefreshToken })
      .expect(200);

    const sessionsResponse = await request(app.getHttpServer())
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${secondAccessToken}`)
      .expect(200);
    const sessionsBody = sessionsResponse.body as SessionItem[];

    expect(Array.isArray(sessionsBody)).toBe(true);
    expect(sessionsBody.length).toBeGreaterThanOrEqual(2);

    const deviceBSession = sessionsBody.find(
      (item) => item.deviceId === 'e2e-device-b',
    );

    expect(deviceBSession).toBeDefined();
    if (!deviceBSession) {
      throw new Error('Expected a session for e2e-device-b');
    }

    await request(app.getHttpServer())
      .delete(`/auth/sessions/${deviceBSession.id}`)
      .set('Authorization', `Bearer ${firstAccessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: secondRefreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${firstAccessToken}`)
      .send({})
      .expect(204);
  });
});
