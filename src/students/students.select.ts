import { Prisma } from '../generated/prisma/client.js';

export const studentPublicSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  documentNumber: true,
  birthDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StudentSelect;

export type StudentResponse = Prisma.StudentGetPayload<{
  select: typeof studentPublicSelect;
}>;
