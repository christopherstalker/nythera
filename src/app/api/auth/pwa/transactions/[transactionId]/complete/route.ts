import { getRequestIp, HttpError, json, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPwaAuthHttpError } from "@/lib/pwa-auth-route-error";
import {
  completePwaAuthTransaction,
  getPwaAuthTransactionForCompletion
} from "@/lib/pwa-auth-transactions";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ transactionId: string }> }
) {
  try {
    const [user, { transactionId }] = await Promise.all([
      requireUser(),
      context.params
    ]);
    const transaction = await getPwaAuthTransactionForCompletion(transactionId);

    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "auth:pwa-complete"
    });

    const providerAccount = await prisma.account.findFirst({
      where: {
        userId: user.id,
        provider: transaction.provider
      },
      select: {
        id: true
      }
    });
    if (!providerAccount) {
      throw new HttpError(403, "The selected provider account was not verified.");
    }

    await completePwaAuthTransaction(transactionId, user.id);

    return json(
      { status: "ready" },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return routeError(toPwaAuthHttpError(error));
  }
}
