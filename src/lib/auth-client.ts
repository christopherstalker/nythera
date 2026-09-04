import { normalizeCallbackPath } from "@/lib/auth-routes";

export type StoredPwaAuthTransaction = {
  transactionId: string;
  nonce: string;
  callbackPath: string;
  provider: string;
  expiresAt: number;
};

export const PWA_AUTH_SESSION_STORAGE_KEY = "nythera:pwa-auth-transaction";

export async function hasAuthenticatedSession() {
  try {
    const response = await fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin"
    });
    if (!response.ok) {
      return false;
    }

    const body = await response.json().catch(() => null);
    return Boolean(body?.user?.id);
  } catch {
    return false;
  }
}

export function storePwaAuthTransaction(transaction: StoredPwaAuthTransaction) {
  sessionStorage.setItem(
    PWA_AUTH_SESSION_STORAGE_KEY,
    JSON.stringify(transaction)
  );
}

export function readStoredPwaAuthTransaction() {
  const raw = sessionStorage.getItem(PWA_AUTH_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const transaction = JSON.parse(raw) as Partial<StoredPwaAuthTransaction>;
    if (
      !/^[A-Za-z0-9_-]{32}$/.test(transaction.transactionId ?? "") ||
      !/^[A-Za-z0-9_-]{43}$/.test(transaction.nonce ?? "") ||
      typeof transaction.callbackPath !== "string" ||
      typeof transaction.provider !== "string" ||
      typeof transaction.expiresAt !== "number" ||
      transaction.expiresAt <= Date.now()
    ) {
      clearStoredPwaAuthTransaction();
      return null;
    }

    return {
      ...(transaction as StoredPwaAuthTransaction),
      callbackPath: normalizeCallbackPath(transaction.callbackPath)
    };
  } catch {
    clearStoredPwaAuthTransaction();
    return null;
  }
}

export function clearStoredPwaAuthTransaction() {
  sessionStorage.removeItem(PWA_AUTH_SESSION_STORAGE_KEY);
}
