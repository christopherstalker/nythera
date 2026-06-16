import { getEnabledOAuthProviders, OAUTH_PROVIDER_META } from "@/lib/oauth-providers";
import { json } from "@/lib/api";

export async function GET() {
  const providers = getEnabledOAuthProviders().map((id) => OAUTH_PROVIDER_META[id]);
  return json({ providers });
}
