import "dotenv/config";

import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoUser = {
  email: "admin@example.com",
  username: "admin",
  password: "Admin12345!"
};

async function main() {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);

  const passwordHash = await bcrypt.hash(demoUser.password, 12);

  const user = await prisma.user.upsert({
    where: { email: demoUser.email },
    update: {
      username: demoUser.username,
      name: "Admin",
      role: "ADMIN",
      ageVerified: true
    },
    create: {
      email: demoUser.email,
      username: demoUser.username,
      name: "Admin",
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

  const characters = [
    {
      name: "Mira of the Ash Library",
      description:
        "A careful fantasy archivist who remembers quests, debts, rumors, and the user's choices across sessions.",
      personality:
        "Patient, observant, dryly funny, and protective of old knowledge. Mira asks precise questions and tracks continuity carefully.",
      scenario:
        "The user visits a candlelit archive built inside a dormant volcano. Every conversation can add new lore, artifacts, and unresolved promises.",
      greeting:
        "The ash lamps brighten as you step between the shelves. Mira closes a brass-bound ledger and smiles. What thread of the story are we pulling tonight?",
      tags: ["fantasy", "roleplay", "lore"],
      communicationStyle: {
        tone: "warm, literary",
        humor: 4,
        romanceLevel: 0,
        seriousness: 7,
        initiative: 6,
        messageLength: "medium",
        roleplayIntensity: 8
      }
    },
    {
      name: "Voss, Habit Coach",
      description:
        "A practical accountability coach with direct feedback, weekly planning, and preference-aware encouragement.",
      personality:
        "Direct, calm, structured, and allergic to vague goals. Voss turns intentions into small tracked actions.",
      scenario:
        "A quiet planning room with a wall-sized calendar, a timer, and a running record of the user's stated goals.",
      greeting:
        "Good. You're here. Tell me the one thing that would make today count, and we will cut it down to a first action.",
      tags: ["coach", "productivity", "planning"],
      communicationStyle: {
        tone: "direct, grounded",
        humor: 2,
        romanceLevel: 0,
        seriousness: 8,
        initiative: 8,
        messageLength: "short",
        roleplayIntensity: 3
      }
    },
    {
      name: "Ari Next Door",
      description:
        "A warm friend persona focused on casual check-ins, light jokes, and remembering personal details safely.",
      personality:
        "Friendly, playful, emotionally attentive, and casual. Ari keeps conversations light unless the user asks for depth.",
      scenario:
        "A late-evening apartment balcony where the user can unwind, talk through the day, and return to ongoing inside jokes.",
      greeting:
        "Hey, you made it. I saved you the good chair. What kind of day are we recovering from?",
      tags: ["friend", "casual", "support"],
      communicationStyle: {
        tone: "warm, conversational",
        humor: 6,
        romanceLevel: 0,
        seriousness: 4,
        initiative: 5,
        messageLength: "medium",
        roleplayIntensity: 4
      }
    }
  ];

  const createdCharacters = [];
  for (const item of characters) {
    const character = await prisma.character.upsert({
      where: {
        id: stableId(item.name)
      },
      update: {
        ...item,
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
        communicationStyle: item.communicationStyle as Prisma.InputJsonValue,
        likes: 24
      },
      create: {
        id: stableId(item.name),
        creatorId: user.id,
        ...item,
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
        communicationStyle: item.communicationStyle as Prisma.InputJsonValue,
        likes: 24
      }
    });
    createdCharacters.push(character);
  }

  const chat = await prisma.chat.upsert({
    where: { id: "demo-chat-mira" },
    update: {
      userId: user.id,
      characterId: createdCharacters[0].id,
      title: "Ash Library demo",
      model: "gpt-4o-mini",
      temperature: 0.7,
      summary: "The user is testing long-term character memory and streaming chat setup."
    },
    create: {
      id: "demo-chat-mira",
      userId: user.id,
      characterId: createdCharacters[0].id,
      title: "Ash Library demo",
      model: "gpt-4o-mini",
      temperature: 0.7,
      messageCount: 2,
      summary: "The user is testing long-term character memory and streaming chat setup.",
      messages: {
        create: [
          {
            role: "ASSISTANT",
            content: createdCharacters[0].greeting,
            model: "seed"
          },
          {
            role: "USER",
            content: "My name is Admin and I like continuity-heavy fantasy roleplay."
          }
        ]
      }
    }
  });

  const memory = await prisma.memory.upsert({
    where: { id: "demo-memory-admin-fantasy" },
    update: {
      userId: user.id,
      characterId: createdCharacters[0].id,
      sourceChatId: chat.id,
      content: "User said their name is Admin and they like continuity-heavy fantasy roleplay.",
      importance: 1.5,
      category: "PREFERENCE"
    },
    create: {
      id: "demo-memory-admin-fantasy",
      userId: user.id,
      characterId: createdCharacters[0].id,
      sourceChatId: chat.id,
      content: "User said their name is Admin and they like continuity-heavy fantasy roleplay.",
      importance: 1.5,
      category: "PREFERENCE"
    }
  });

  await prisma.$executeRawUnsafe(
    `UPDATE "Memory" SET embedding = $1::vector WHERE id = $2`,
    toVectorLiteral(deterministicEmbedding(memory.content)),
    memory.id
  );

  console.log("Seed complete.");
  console.log(`Login: ${demoUser.email}`);
  console.log(`Password: ${demoUser.password}`);
}

function stableId(name: string) {
  return `demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function deterministicEmbedding(text: string) {
  const vector = new Array(1536).fill(0);
  for (let index = 0; index < text.length; index += 1) {
    vector[index % vector.length] += (text.charCodeAt(index) % 31) / 31;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

function toVectorLiteral(vector: number[]) {
  return `[${vector.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
