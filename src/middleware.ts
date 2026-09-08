import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { productionDeploymentRedirectUrl } from "@/lib/site-origin";
import { contentSecurityPolicy } from "@/lib/content-security-policy";

export function middleware(request: NextRequest) {
  const destination = productionDeploymentRedirectUrl(
    request.url,
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    process.env.VERCEL_ENV
  );

  if (destination) return NextResponse.redirect(destination, 307);

  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "production");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
