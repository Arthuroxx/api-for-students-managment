import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_USER_PASSWORD;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  if (!email || !password) {
    throw new Error(
      'SEED_USER_EMAIL and SEED_USER_PASSWORD must be defined to seed a user',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, passwordHash },
      select: { id: true, email: true },
    });

    console.log(`Seeded user ${user.email} (${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
