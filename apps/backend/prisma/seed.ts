import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const newCode = await prisma.inviteCode.upsert({
    where: { code: 'boss-code' },
    update: { usage: 1000 },
    create: {
      code: 'boss-code',
      usage: 1000,
    },
  });

  console.log('boss-code created');
  console.log(newCode);

  const adminUsername = process.env.ADMIN_SEED_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_SEED_PASSWORD?.trim();

  if (adminUsername && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 13);
    const adminUser = await prisma.adminUser.upsert({
      where: { username: adminUsername },
      update: { passwordHash },
      create: {
        username: adminUsername,
        passwordHash,
      },
    });

    console.log(`Admin user seeded: ${adminUser.username}`);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
