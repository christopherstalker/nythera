import { z } from "zod";
import { getRequestIp, HttpError, json, parseJson, routeError } from "@/lib/api";
import { normalizeCallbackPath } from "@/lib/auth-routes";
import { OAUTH_PROVIDER_IDS } from "@/lib/oauth-provider-ids";
import { getEnabledOAuthProviders } from "@/lib/oauth-providers";
import { toPwaAuthHttpError } from "@/lib/pwa-auth-route-error";
import { createPwaAuthTransaction } from "@/lib/pwa-auth-transactions";
import { enforceRateLimit } from "@/lib/rate-limit";

const createTransactionSchema = z.object({
  provider: z.enum(OAUTH_PROVIDER_IDS),
  callbackUrl: z.string().max(2048).optional()
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      ip: getRequestIp(request),
      route: "auth:pwa-create"
    });

    const input = await parseJson(request, createTransactionSchema);
    if (!getEnabledOAuthProviders().includes(input.provider)) {
      throw new HttpError(400, "This sign-in provider is unavailable.");
    }

    const transaction = await createPwaAuthTransaction({
      provider: input.provider,
      callbackPath: normalizeCallbackPath(input.callbackUrl)
    });

    return json(
      {
        ...transaction,
        startUrl: `/auth/pwa/start?transactionId=${encodeURIComponent(transaction.transactionId)}`
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return routeError(toPwaAuthHttpError(error));
  }
}
