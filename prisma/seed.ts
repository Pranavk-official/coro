import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import config from "./seed-config.json" with { type: "json" };

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  for (const user of config.users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: true,
      },
    });
  }
  for (const room of config.rooms) {
    await prisma.room.upsert({
      where: { code: room.code },
      update: {},
      create: {
        code: room.code,
        name: room.name,
        kind: room.kind,
        hostId: room.hostId,
        allowGuests: room.allowGuests ?? true,
      },
    });
  }
  console.log(`seeded ${config.users.length} users, ${config.rooms.length} rooms`);
}

await main();
await prisma.$disconnect();
