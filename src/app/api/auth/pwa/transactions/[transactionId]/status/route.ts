import { z } from "zod";
import { getRequestIp, json, parseJson, routeError } from "@/lib/api";
import { toPwaAuthHttpError } from "@/lib/pwa-auth-route-error";
import { getPwaAuthTransactionStatus } from "@/lib/pwa-auth-transactions";
import { enforceRateLimit } from "@/lib/rate-limit";

const transactionStatusSchema = z.object({
  nonce: z.string().regex(/^[A-Za-z0-9_-]{43}$/)
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ transactionId: string }> }
) {
  try {
    await enforceRateLimit({
      ip: getRequestIp(request),
      route: "auth:pwa-status"
    });

    const [{ transactionId }, input] = await Promise.all([
      context.params,
      parseJson(request, transactionStatusSchema)
    ]);
    const status = await getPwaAuthTransactionStatus(transactionId, input.nonce);

    return json(
      { status },
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
