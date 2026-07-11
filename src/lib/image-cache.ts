export function shouldBypassNextImageOptimization(src: string) {
  const normalized = src.trim().toLowerCase();
  return (
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:") ||
    normalized.endsWith(".svg")
  );
}
