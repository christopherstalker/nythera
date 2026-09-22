import { INTEGRATION_SCOPES } from "@/lib/integration-policy";
import { resolveSiteOrigin } from "@/lib/site-origin";

export function GET() {
  const origin = resolveSiteOrigin();
  return Response.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/integrations/oauth/token`,
    registration_endpoint: `${origin}/api/integrations/oauth/register`,
    revocation_endpoint: `${origin}/api/integrations/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    authorization_response_iss_parameter_supported: true,
    scopes_supported: INTEGRATION_SCOPES
  });
}
