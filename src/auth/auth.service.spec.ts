import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { hashPassword } from './password.js';

describe('AuthService', () => {
  const password = 'Valid-password-123!';
  const email = 'user@example.com';
  let passwordHash: string;
  let service: AuthService;
  let findUnique: ReturnType<typeof vi.fn>;
  let signAsync: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    passwordHash = await hashPassword(password);
  });

  beforeEach(() => {
    findUnique = vi.fn();
    signAsync = vi.fn().mockResolvedValue('signed-token');

    service = new AuthService(
      { user: { findUnique } } as unknown as PrismaService,
      { signAsync } as unknown as JwtService,
      {
        getOrThrow: vi.fn().mockReturnValue(3600),
      } as unknown as ConfigService,
    );
  });

  it('returns a signed token with the user role for valid credentials', async () => {
    findUnique.mockResolvedValue({
      id: 'user-1',
      email,
      passwordHash,
      role: UserRole.ADMIN,
    });

    const result = await service.login({
      email: '  User@Example.com ',
      password,
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
    expect(signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email,
      role: UserRole.ADMIN,
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      role: UserRole.ADMIN,
    });
  });

  it('rejects an unknown email', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'unknown@example.com', password }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('rejects an invalid password', async () => {
    findUnique.mockResolvedValue({
      id: 'user-1',
      email,
      passwordHash,
      role: UserRole.USER,
    });

    await expect(
      service.login({ email, password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signAsync).not.toHaveBeenCalled();
  });
});
