import { getRequestIp, json, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { discoverProviderModels } from "@/lib/provider-model-catalog";
import { getDecryptedProviderKeys } from "@/lib/user-keys";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "keys:models"
    });
    const force = new URL(request.url).searchParams.get("refresh") === "1";
    const keys = await getDecryptedProviderKeys(user.id);
    const providers = await Promise.all(keys.map((key) => discoverProviderModels(key, { force })));

    return json(
      { providers },
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (error) {
    return routeError(error);
  }
}
