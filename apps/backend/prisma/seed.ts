import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  
  const newCode = await prisma.inviteCode.create({
    data: {
      code: 'boss-code',
      usage: 1000,
    },
  });

  console.log('boss-code created');
  console.log(newCode);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });