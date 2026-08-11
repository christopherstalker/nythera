import { NextResponse } from "next/server";
import { getRequestIp } from "@/lib/api";
import { signIn } from "@/lib/auth";
import {
  getPwaAuthTransactionForStart,
  PwaAuthTransactionError
} from "@/lib/pwa-auth-transactions";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorRedirect(request: Request, reason: "expired" | "unavailable") {
  return NextResponse.redirect(
    new URL(`/auth/pwa/error?reason=${reason}`, request.url),
    303
  );
}

export async function GET(request: Request) {
  const transactionId = new URL(request.url).searchParams.get("transactionId") ?? "";

  try {
    await enforceRateLimit({
      ip: getRequestIp(request),
      route: "auth:pwa-start"
    });
  } catch {
    return errorRedirect(request, "unavailable");
  }

  if (!/^[A-Za-z0-9_-]{32}$/.test(transactionId)) {
    return errorRedirect(request, "expired");
  }

  let transaction: Awaited<ReturnType<typeof getPwaAuthTransactionForStart>>;
  try {
    transaction = await getPwaAuthTransactionForStart(transactionId);
  } catch (error) {
    return errorRedirect(
      request,
      error instanceof PwaAuthTransactionError ? "expired" : "unavailable"
    );
  }

  const completionUrl = `/auth/pwa/complete?transactionId=${encodeURIComponent(transactionId)}`;

  try {
    const providerUrl = await signIn(transaction.provider, {
      redirect: false,
      redirectTo: completionUrl
    });

    if (typeof providerUrl !== "string") {
      return errorRedirect(request, "unavailable");
    }

    return NextResponse.redirect(providerUrl, 303);
  } catch {
    return errorRedirect(request, "unavailable");
  }
}
