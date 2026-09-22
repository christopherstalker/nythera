import { integrationResource } from "@/lib/integration-auth";
import { INTEGRATION_SCOPES } from "@/lib/integration-policy";
import { resolveSiteOrigin } from "@/lib/site-origin";

export function GET() {
  return Response.json({
    resource: integrationResource(),
    authorization_servers: [resolveSiteOrigin()],
    scopes_supported: INTEGRATION_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Nythera characters"
  });
}
