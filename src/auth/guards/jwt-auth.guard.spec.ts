import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../generated/prisma/enums.js';
import { AuthenticatedUser } from '../auth.types.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

interface MockRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

const secret = 'test-only-jwt-secret-with-at-least-32-chars';
const payload = {
  sub: 'user-1',
  email: 'user@example.com',
  role: UserRole.ADMIN,
};

function createContext(request: MockRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwtService = new JwtService({
    secret,
    signOptions: { expiresIn: 3600 },
  });
  const guard = new JwtAuthGuard(jwtService);

  it('rejects requests without an authorization header', async () => {
    await expect(
      guard.canActivate(createContext({ headers: {} })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects requests with a non-Bearer scheme', async () => {
    const token = jwtService.sign(payload);

    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: `Basic ${token}` } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid tokens', async () => {
    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: 'Bearer invalid-token' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects expired tokens', async () => {
    const token = jwtService.sign(payload, { expiresIn: -1 });

    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects payloads without a subject', async () => {
    const token = jwtService.sign({ email: payload.email, role: payload.role });

    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects payloads with an invalid role', async () => {
    const token = jwtService.sign({ ...payload, role: 'SUPERADMIN' });

    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('attaches the authenticated user with role to the request', async () => {
    const token = jwtService.sign(payload);
    const request: MockRequest = {
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    });
  });
});
