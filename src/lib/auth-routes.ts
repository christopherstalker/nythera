export function isProtectedPath(pathname: string) {
  if (pathname.startsWith("/settings")) {
    return true;
  }
  if (pathname.startsWith("/library")) {
    return true;
  }
  if (pathname.startsWith("/create-character")) {
    return true;
  }
  if (pathname.startsWith("/chats")) {
    return true;
  }
  if (pathname.startsWith("/chat/")) {
    return true;
  }
  if (/^\/character\/[^/]+\/edit/.test(pathname)) {
    return true;
  }

  return false;
}

export function isGuestBrowsePath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/explore") || /^\/character\/[^/]+$/.test(pathname);
}

export function loginUrl(callbackPath?: string) {
  const path = normalizeCallbackPath(callbackPath);
  return `/login?callbackUrl=${encodeURIComponent(path)}`;
}

export function normalizeCallbackPath(value: string | null | undefined, fallback = "/explore") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://nythera.invalid");
    return parsed.origin === "https://nythera.invalid"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
