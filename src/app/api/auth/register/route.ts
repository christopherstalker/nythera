import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { json, parseJson, routeError } from "@/lib/api";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, registerSchema);
    const email = input.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          username: input.username,
          name: input.username
        }
      });

      await tx.passwordCredential.create({
        data: {
          userId: created.id,
          passwordHash
        }
      });

      return created;
    });

    return json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    return routeError(error);
  }
}
