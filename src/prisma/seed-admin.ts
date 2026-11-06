import { hashPassword } from '../auth/password.js';
import { UserRole } from '../generated/prisma/enums.js';

export interface SeedAdminUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Minimal slice of the Prisma user delegate used by the seed. Keeping it small
 * makes the seed logic testable without a database connection.
 */
export interface SeedAdminUserDelegate {
  findUnique(query: {
    where: { email: string };
    select: { id: true; email: true; role: true };
  }): Promise<SeedAdminUser | null>;
  create(query: {
    data: { email: string; passwordHash: string; role: UserRole };
    select: { id: true; email: true; role: true };
  }): Promise<SeedAdminUser>;
}

export interface EnsureAdminUserResult extends SeedAdminUser {
  created: boolean;
}

/**
 * Creates the seed ADMIN user only when it does not exist yet.
 *
 * An existing user is returned untouched: re-running the seed must never
 * overwrite a password or downgrade/upgrade the role chosen by an operator.
 */
export async function ensureAdminUser(
  delegate: SeedAdminUserDelegate,
  email: string,
  password: string,
): Promise<EnsureAdminUserResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const selection = { id: true, email: true, role: true } as const;

  const existing = await delegate.findUnique({
    where: { email: normalizedEmail },
    select: selection,
  });

  if (existing) {
    return { ...existing, created: false };
  }

  const user = await delegate.create({
    data: {
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      role: UserRole.ADMIN,
    },
    select: selection,
  });

  return { ...user, created: true };
}
