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
  const path = callbackPath && callbackPath.startsWith("/") ? callbackPath : "/explore";
  return `/login?callbackUrl=${encodeURIComponent(path)}`;
}
