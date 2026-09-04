export function shouldBypassNextImageOptimization(src: string) {
  const normalized = src.trim().toLowerCase();
  return (
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.endsWith(".svg")
  );
}
