import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoUser = {
  email: "chrisstalker@gmail.com",
  username: "chris",
  password: "Admin12345!"
};

async function main() {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);

  const passwordHash = await bcrypt.hash(demoUser.password, 12);

  const user = await prisma.user.upsert({
    where: { email: demoUser.email },
    update: {
      username: demoUser.username,
      name: "Chris",
      role: "ADMIN",
      ageVerified: true
    },
    create: {
      email: demoUser.email,
      username: demoUser.username,
      name: "Chris",
      role: "ADMIN",
      ageVerified: true,
      passwordCredential: {
        create: {
          passwordHash
        }
      }
    }
  });

  await prisma.passwordCredential.upsert({
    where: { userId: user.id },
    update: { passwordHash },
    create: {
      userId: user.id,
      passwordHash
    }
  });

  console.log("Seed complete. No demo characters were created.");
  console.log(`Login: ${demoUser.email}`);
  console.log(`Password: ${demoUser.password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
