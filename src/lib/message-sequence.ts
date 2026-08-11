import "server-only";

import { Prisma, type Message, type RoomMessage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sleep } from "@/lib/utils";

const MAX_SEQUENCE_RETRIES = 5;

export async function createMessageWithNextSequence(
  data: Omit<Prisma.MessageUncheckedCreateInput, "sequence">
): Promise<Message> {
  for (let attempt = 0; attempt < MAX_SEQUENCE_RETRIES; attempt += 1) {
    try {
      // The transaction-scoped advisory lock serializes only writers for this chat across app instances.
      return await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${data.chatId}, 0))::text AS lock_result`;
          const last = await tx.message.aggregate({
            where: { chatId: data.chatId },
            _max: { sequence: true }
          });

          const createData: Prisma.MessageUncheckedCreateInput = {
            ...data,
            sequence: (last._max.sequence ?? 0) + 1
          };

          return tx.message.create({ data: createData });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
      );
    } catch (error) {
      if (!isRetryableSequenceConflict(error) || attempt === MAX_SEQUENCE_RETRIES - 1) {
        throw error;
      }

      await sleep(retryDelay(attempt));
    }
  }

  throw new Error("Could not allocate message sequence.");
}

export async function createRoomMessageWithNextSequence(
  data: Omit<Prisma.RoomMessageUncheckedCreateInput, "sequence">
): Promise<RoomMessage> {
  for (let attempt = 0; attempt < MAX_SEQUENCE_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${data.roomId}, 0))::text AS lock_result`;
          const last = await tx.roomMessage.aggregate({
            where: { roomId: data.roomId },
            _max: { sequence: true }
          });

          const createData: Prisma.RoomMessageUncheckedCreateInput = {
            ...data,
            sequence: (last._max.sequence ?? 0) + 1
          };

          return tx.roomMessage.create({ data: createData });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
      );
    } catch (error) {
      if (!isRetryableRoomSequenceConflict(error) || attempt === MAX_SEQUENCE_RETRIES - 1) {
        throw error;
      }

      await sleep(retryDelay(attempt));
    }
  }

  throw new Error("Could not allocate room message sequence.");
}

function isRetryableSequenceConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (TRANSIENT_DATABASE_CODES.has(error.code)) {
    return true;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  return Array.isArray(target) && target.includes("chatId") && target.includes("sequence");
}

function isRetryableRoomSequenceConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (TRANSIENT_DATABASE_CODES.has(error.code)) {
    return true;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  return Array.isArray(target) && target.includes("roomId") && target.includes("sequence");
}

const TRANSIENT_DATABASE_CODES = new Set(["P1001", "P1002", "P1017", "P2024", "P2034"]);

function retryDelay(attempt: number) {
  const exponentialDelay = 25 * 2 ** attempt;
  return exponentialDelay + Math.floor(Math.random() * 20);
}
