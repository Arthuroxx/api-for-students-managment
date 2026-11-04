import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma/enums.js';
import { AuthenticatedUser } from '../auth.types.js';
import { Roles } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

class TestController {
  @Roles(UserRole.ADMIN)
  adminOnly(this: void): void {}

  @Roles(UserRole.ADMIN, UserRole.USER)
  authenticated(this: void): void {}

  public(this: void): void {}
}

function createContext(
  handler: () => void,
  user?: AuthenticatedUser,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };
  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: UserRole.USER,
  };

  it('allows handlers without role metadata', () => {
    expect(
      guard.canActivate(createContext(TestController.prototype.public)),
    ).toBe(true);
  });

  it('allows the required role', () => {
    expect(
      guard.canActivate(
        createContext(TestController.prototype.adminOnly, admin),
      ),
    ).toBe(true);
  });

  it('allows any explicitly permitted role', () => {
    expect(
      guard.canActivate(
        createContext(TestController.prototype.authenticated, user),
      ),
    ).toBe(true);
  });

  it('rejects an insufficient role', () => {
    expect(() =>
      guard.canActivate(
        createContext(TestController.prototype.adminOnly, user),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects requests without an authenticated user', () => {
    expect(() =>
      guard.canActivate(createContext(TestController.prototype.adminOnly)),
    ).toThrow(ForbiddenException);
  });
});
