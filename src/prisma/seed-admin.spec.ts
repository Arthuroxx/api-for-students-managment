import { hashPassword } from '../auth/password.js';
import { UserRole } from '../generated/prisma/enums.js';
import { ensureAdminUser } from './seed-admin.js';
import type {
  EnsureAdminUserResult,
  SeedAdminUser,
  SeedAdminUserDelegate,
} from './seed-admin.js';

vi.mock('../auth/password.js', () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));

const existingUser: SeedAdminUser = {
  id: 'user-1',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
};

function createDelegate(options: { existing: SeedAdminUser | null }): {
  delegate: SeedAdminUserDelegate;
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
} {
  const findUnique = vi.fn(async () => options.existing);
  const create = vi.fn(async ({ data }: { data: unknown }) => ({
    id: 'user-created',
    email: (data as { email: string }).email,
    role: UserRole.ADMIN,
  }));

  return {
    delegate: { findUnique, create } as unknown as SeedAdminUserDelegate,
    findUnique,
    create,
  };
}

describe('ensureAdminUser', () => {
  beforeEach(() => {
    vi.mocked(hashPassword).mockClear();
  });

  it('does not modify an existing user', async () => {
    const { delegate, findUnique, create } = createDelegate({
      existing: existingUser,
    });

    const result: EnsureAdminUserResult = await ensureAdminUser(
      delegate,
      'ADMIN@example.com ',
      'new-password',
    );

    expect(result).toEqual({ ...existingUser, created: false });
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
      select: { id: true, email: true, role: true },
    });
    expect(create).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it('creates an ADMIN user with a hashed password when it does not exist', async () => {
    const { delegate, create } = createDelegate({ existing: null });

    const result = await ensureAdminUser(
      delegate,
      ' Admin@Example.com ',
      'super-secret',
    );

    expect(hashPassword).toHaveBeenCalledWith('super-secret');
    expect(create).toHaveBeenCalledWith({
      data: {
        email: 'admin@example.com',
        passwordHash: 'hashed:super-secret',
        role: UserRole.ADMIN,
      },
      select: { id: true, email: true, role: true },
    });
    expect(result).toEqual({
      id: 'user-created',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      created: true,
    });
  });
});
