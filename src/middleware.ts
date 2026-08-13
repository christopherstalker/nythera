import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { productionDeploymentRedirectUrl } from "@/lib/site-origin";

export function middleware(request: NextRequest) {
  const destination = productionDeploymentRedirectUrl(
    request.url,
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    process.env.VERCEL_ENV
  );

  return destination
    ? NextResponse.redirect(destination, 307)
    : NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
