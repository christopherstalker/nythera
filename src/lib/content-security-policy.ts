export function contentSecurityPolicy(nonce: string, production: boolean) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${production ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://*.blob.vercel-storage.com",
    `connect-src 'self' https://challenges.cloudflare.com https://*.blob.vercel-storage.com https://*.vercel.app${production ? "" : " ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:*"}`,
    "media-src 'self' data: blob: https:",
    "frame-src 'self' https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    production ? "upgrade-insecure-requests" : ""
  ]
    .filter(Boolean)
    .join("; ");
}
