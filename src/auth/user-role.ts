import { UserRole } from '../generated/prisma/enums.js';

const USER_ROLES = new Set<string>(Object.values(UserRole));

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.has(value);
}
