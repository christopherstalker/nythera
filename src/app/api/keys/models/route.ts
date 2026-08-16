import { getRequestIp, json, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { discoverProviderModels } from "@/lib/provider-model-catalog";
import { getDecryptedProviderKeys } from "@/lib/user-keys";
import { prisma } from "@/lib/prisma";

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
    const keys = await getDecryptedProviderKeys(user.id, { includeInvalid: true });
    const keysByProvider = new Map<string, typeof keys>();
    for (const key of keys) {
      const providerKeys = keysByProvider.get(key.provider) ?? [];
      providerKeys.push(key);
      keysByProvider.set(key.provider, providerKeys);
    }
    const discoveries = await Promise.all(Array.from(keysByProvider.values(), async (providerKeys) => {
      const representative = [...providerKeys].sort((left, right) =>
        Number(right.credentialStatus === "VALID") - Number(left.credentialStatus === "VALID") ||
        Number(Boolean(right.isDefault)) - Number(Boolean(left.isDefault)) ||
        (left.providerPriority ?? 0) - (right.providerPriority ?? 0)
      )[0]!;
      return {
        representative,
        providerKeys,
        catalog: await discoverProviderModels(representative, { force })
      };
    }));
    const providers = discoveries.flatMap(({ catalog, providerKeys }) => providerKeys.map((key) => ({
      ...catalog,
      keyId: key.id,
      keyLabel: key.label,
      last4: key.apiKey.slice(-4)
    })));
    await Promise.all(discoveries.map(async ({ catalog, representative }) => {
      const status = credentialStatusFromDiscovery(catalog);
      if (!status || !representative.id) return;

      await prisma.userApiKey.updateMany({
        where: { id: representative.id, userId: user.id },
        data: {
          credentialStatus: status,
          validatedAt: new Date(),
          ...(status === "INVALID" ? { fallbackEnabled: false, fallbackPriority: null } : {})
        }
      });
    }));

    return json(
      { providers },
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (error) {
    return routeError(error);
  }
}

function credentialStatusFromDiscovery(provider: { source: string; warning?: string }) {
  const warning = provider.warning?.toLowerCase() ?? "";
  if (warning.includes("rejected this api key") || warning.includes("insufficient api balance") || warning.includes("no available api balance")) {
    return "INVALID" as const;
  }
  return provider.source === "live" ? "VALID" as const : null;
}
