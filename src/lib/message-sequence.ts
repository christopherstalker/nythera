import "server-only";

import { Prisma, type Message } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sleep } from "@/lib/utils";

const MAX_SEQUENCE_RETRIES = 3;

export async function createMessageWithNextSequence(
  data: Omit<Prisma.MessageUncheckedCreateInput, "sequence">
): Promise<Message> {
  for (let attempt = 0; attempt < MAX_SEQUENCE_RETRIES; attempt += 1) {
    try {
      // Sequence allocation is scoped to the chat row set and retried on serializable/unique conflicts.
      // That keeps parallel tabs, mobile clients, and Vercel instances from assigning the same sequence.
      return await prisma.$transaction(
        async (tx) => {
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
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (!isRetryableSequenceConflict(error) || attempt === MAX_SEQUENCE_RETRIES - 1) {
        throw error;
      }

      await sleep(15 * (attempt + 1));
    }
  }

  throw new Error("Could not allocate message sequence.");
}

function isRetryableSequenceConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code === "P2034") {
    return true;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  return Array.isArray(target) && target.includes("chatId") && target.includes("sequence");
}
