import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { hashPassword } from './../src/auth/password.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

interface LoginResponseBody {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  const runTag = `auth-${Date.now()}`;
  const email = `${runTag}@example.com`;
  const password = 'E2e-password-123!';
  let userId: string;
  let accessToken: string;
  let expectedExpiresIn: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    expectedExpiresIn = app
      .get(ConfigService)
      .getOrThrow<number>('JWT_EXPIRES_IN_SECONDS');

    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password) },
    });
    userId = user.id;
    accessToken = await jwtService.signAsync({ sub: userId, email });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('logs in with valid credentials and returns a valid JWT', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email.toUpperCase(), password })
      .expect(200);

    const body = response.body as LoginResponseBody;

    expect(body.tokenType).toBe('Bearer');
    expect(body.expiresIn).toBe(expectedExpiresIn);
    await expect(
      jwtService.verifyAsync(body.accessToken),
    ).resolves.toMatchObject({ sub: userId, email });
  });

  it('rejects invalid credentials with a generic message', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'unknown@example.com', password })
      .expect(401);

    expect(wrongPassword.body).toMatchObject({
      message: 'Invalid email or password',
    });
    expect(unknownEmail.body).toMatchObject({
      message: 'Invalid email or password',
    });
  });

  it('rejects invalid login payloads', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password, role: 'admin' })
      .expect(400);
  });

  it('protects every student endpoint', async () => {
    const server = app.getHttpServer();
    const studentId = randomUUID();

    await request(server).get('/students').expect(401);
    await request(server).get(`/students/${studentId}`).expect(401);
    await request(server).post('/students').send({}).expect(401);
    await request(server).patch(`/students/${studentId}`).send({}).expect(401);
    await request(server).delete(`/students/${studentId}`).expect(401);
  });

  it('accepts valid Bearer tokens on protected endpoints', async () => {
    await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('rejects malformed authorization headers', async () => {
    await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', 'Bearer')
      .expect(401);

    await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', 'Basic credentials')
      .expect(401);
  });

  it('rejects invalid and expired tokens', async () => {
    const invalidToken = jwtService.sign(
      { sub: userId, email },
      { secret: 'another-test-secret-with-32-characters-min' },
    );
    const expiredToken = jwtService.sign(
      { sub: userId, email },
      { expiresIn: -1 },
    );

    await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${invalidToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });
});
