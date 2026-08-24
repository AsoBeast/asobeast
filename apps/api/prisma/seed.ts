import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  await prisma.workspace.upsert({
    where: { id: 'ws_default' },
    update: {},
    create: { id: 'ws_default', name: 'Default' },
  });
}

main().finally(() => prisma.$disconnect());
