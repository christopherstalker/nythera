export function safeLocalRedirect(
  value: string | null | undefined,
  fallback = "/explore",
) {
  const target = value?.trim();
  if (
    !target ||
    !target.startsWith("/") ||
    target.startsWith("//") ||
    target.includes("\\") ||
    /[\u0000-\u001f]/.test(target)
  ) {
    return fallback;
  }
  return target;
}
