# Nythera Security Hardening Report - 2026-07-03

Scope: defensive hardening only. No user-facing UI or feature changes were made.

## Phase 1 - Secrets & API Key Protection

### Already correctly implemented

- Saved model-provider and voice-provider API key response shapes already expose metadata only, including `last4`, and do not return plaintext keys or `encryptedKey` fields.
- BYOK storage already used AES-256-GCM with an auth tag and per-encryption random IVs.
- Decrypted provider keys are obtained in provider-call paths and are not stored in long-lived module globals by the current implementation.
- No real hardcoded provider token formats were found by the refined key scan.
- No `NEXT_PUBLIC_*` environment variable names in `.env` or `.env.example` are secret-like.

### Vulnerable and fixed

- `src/lib/crypto.ts`: BYOK encryption previously derived its key from `NEXTAUTH_SECRET || AUTH_SECRET || INTERNAL_API_TOKEN`. This coupled API-key encryption to auth secrets and allowed a non-dedicated fallback. It now uses `API_KEY_ENCRYPTION_SECRET` as the primary secret, requires it in production, enforces a minimum production length, and keeps legacy `NEXTAUTH_SECRET` / `AUTH_SECRET` decryption fallback for previously encrypted records.
- `src/lib/env.ts` and `.env.example`: added `API_KEY_ENCRYPTION_SECRET` to the environment schema and sample env file.
- `src/lib/secret-redaction.ts`: added centralized log redaction for bearer tokens, `sk-*` keys, authorization headers, API-key fields, tokens, passwords, and encrypted key fields.
- Replaced raw error logging with redacted logging in `src/lib/api.ts`, `src/lib/proxy.ts`, `src/lib/llm-gateway.ts`, `src/lib/vector.ts`, `src/lib/memory-store.ts`, and `src/app/api/chats/[id]/stream/route.ts`.
- `tests/security-secrets.test.ts`: added static regression coverage for dedicated encryption secret usage, redaction coverage, and key API response safety.

### Requires deployment/operator decision

- Vercel must set distinct `API_KEY_ENCRYPTION_SECRET` values for Production, Preview, and Development. Code can require the variable, but cannot verify Vercel environment separation from the repository.
- If `LLM_PROXY_URL` is used, decrypted BYOK keys are forwarded to that proxy service for the provider request. That service must remain internal/trusted, or BYOK forwarding through the proxy should be disabled.

## Phase 2 - Authorization & IDOR Prevention

### Already correctly implemented

- Most chat, room, persona, memory, and key routes already constrain reads/mutations by `userId`, route helpers, or owner-specific store functions.
- Character create/update data already uses Zod allowlists rather than spreading arbitrary request bodies directly into Prisma writes.
- Provider-heavy chat, room, character generation, and assistant routes already used `enforceRateLimit`.

### Vulnerable and fixed

- `src/app/api/messages/[id]/report/route.ts`: message reporting used `findUnique({ id })`, allowing a logged-in user to report another user's message by ID. It now queries with `chat: { userId: user.id }`.
- `src/app/api/messages/route.ts`: message delete/edit used `findUnique({ id })` then checked ownership after the fetch. It now includes `chat.userId` in the database query and returns 404 for missing or cross-user records.
- `src/app/api/characters/[id]/route.ts`: character edit/delete fetched by ID and then returned 403 for cross-user records. It now queries by ID plus owner, unless the user is an admin, so cross-user records return 404.
- `src/app/api/mobile/characters/[id]/route.ts`: mobile character edit now uses the same owner/admin-constrained query.
- `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/mobile/auth/login/route.ts`, and `src/app/api/mobile/auth/register/route.ts`: auth entrypoints now rate-limit by request IP before credential work.
- `src/lib/rate-limit.ts` and `src/lib/redis.ts`: production rate limiting now fails closed with 503 when no distributed Redis/Upstash store is configured, instead of falling back to an in-memory limiter.
- `tests/security-auth-rate-limit.test.ts` and `tests/security-authorization.test.ts`: added regression coverage.

### Requires deployment/operator decision

- Production must configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` or `REDIS_URL`; otherwise rate-limited production endpoints now correctly fail closed.

## Phase 3 - Input Validation & Injection Prevention

### Already correctly implemented

- Prisma query builder usage is parameterized by default in normal application queries.
- Chat rich text rendering in `src/components/chat/rich-message-text.tsx` does not use `dangerouslySetInnerHTML` or `innerHTML`; parsed markup remains React text nodes/components.
- Local image uploads are re-encoded through canvas before storage, which strips EXIF metadata from uploaded local files.

### Vulnerable and fixed

- `src/lib/vector.ts`: replaced `$queryRawUnsafe` and `$executeRawUnsafe` with Prisma tagged `$queryRaw` / `$executeRaw`.
- `prisma/seed.ts`: replaced `$executeRawUnsafe` with tagged `$executeRaw`.
- `src/lib/validation.ts`: image data URLs now reject SVG, enforce decoded byte limits, validate actual image magic bytes for PNG/JPEG/WEBP/GIF, and only allow HTTPS remote image URLs in production.
- `src/lib/image-upload.ts`: client upload handling now enforces server-aligned size expectations and checks actual file signatures for JPG, PNG, WEBP, GIF, and HEIC/HEIF before decode/re-encode.
- `tests/security-input-validation.test.ts`: added regression coverage for image validation, raw SQL safety, and chat renderer HTML injection avoidance.

### Requires product/security decision

- Remote image URLs are not ingested or stripped by Nythera; they remain externally hosted. If the product later proxies or stores remote images, add server-side fetch validation, content sniffing, re-encoding, and CSP-isolated serving.

## Phase 4 - Transport & HTTP Security

### Already correctly implemented

- NextAuth session expiry is finite (`30 * 24 * 60 * 60`).
- No code was found disabling NextAuth CSRF defaults.
- No custom cookie override was found that weakens NextAuth's default secure/httpOnly cookie handling.

### Vulnerable and fixed

- `next.config.mjs`: added global HTTP security headers:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - production-only `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - Content Security Policy with `frame-ancestors 'none'`, `object-src 'none'`, explicit provider `connect-src` entries, and no production `unsafe-eval`.
- `tests/security-http.test.ts`: added regression coverage for headers and session/CSRF defaults.

### Requires deployment/operator decision

- Repository code cannot prove `NEXTAUTH_SECRET` / `AUTH_SECRET` strength or environment separation. Confirm strong random values are set differently in Production, Preview, and Development.
- CSP currently permits `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'` to avoid breaking the existing Next.js/Tailwind runtime. Removing inline allowances would require a nonce/hash pass and should be handled separately.

## Phase 5 - Dependency & Supply Chain

### Already correctly implemented

- The project already uses a lockfile and `npm audit` can evaluate the dependency graph.

### Vulnerable and fixed

- Ran `npm audit fix`, which updated the lockfile and removed the non-breaking `esbuild` and `form-data` audit findings.
- `.github/dependabot.yml`: added weekly npm Dependabot monitoring with grouped patch/minor updates.

### Vulnerable but requires upgrade decision

- `npm audit` still reports 8 vulnerabilities: 3 moderate and 5 high.
- Remaining fixes require breaking or range-crossing upgrades:
  - `next` to `16.2.10`
  - `eslint-config-next` to `16.2.10`
  - `next-auth` to `5.0.0-beta.31`
  - `nodemailer` to `9.0.3`
- These were not force-upgraded in this hardening pass because they can break framework/auth/email behavior and need a dedicated compatibility pass.

### Dependencies flagged as over one year stale

These were flagged, not auto-upgraded:

- `@anthropic-ai/sdk` current `0.39.0`, latest `0.110.0`, current publish date `2025-02-28`.
- `@google/generative-ai` current `0.21.0`, latest `0.24.1`, current publish date `2024-10-02`.
- `@types/react-dom` current `18.3.7`, latest `19.2.3`, current publish date `2025-04-30`.
- `bcryptjs` current `2.4.3`, latest `3.0.3`, current publish date `2017-02-07`.
- `dotenv` current `16.6.1`, latest `17.4.2`, current publish date `2025-06-27`.
- `eslint` current `8.57.1`, latest `10.6.0`, current publish date `2024-09-16`.
- `lucide-react` current `0.468.0`, latest `1.23.0`, current publish date `2024-12-05`.
- `next-auth` current `5.0.0-beta.25`, latest `4.24.14`, current publish date `2024-10-19`.
- `nodemailer` current `6.10.1`, latest `9.0.3`, current publish date `2025-04-13`.
- `openai` current `4.104.0`, latest `6.45.0`, current publish date `2025-05-29`.
- `react` current `18.3.1`, latest `19.2.7`, current publish date `2024-04-26`.
- `react-dom` current `18.3.1`, latest `19.2.7`, current publish date `2024-04-26`.

## Phase 6 - Data Rights & User Control

### Already correctly implemented

- `prisma/schema.prisma` defines cascade deletes from `User` to `Account`, `Session`, `Authenticator`, `PasswordCredential`, `Character`, `Chat`, `Room`, `ChatShare`, `UserPersona`, `Memory`, `Report`, `CharacterLike`, `CharacterRating`, `UserApiKey`, and `VoiceApiKey`.
- `Message` and `RoomMessage` are deleted through their parent `Chat` / `Room` cascade.
- Stored encrypted BYOK keys are covered by `UserApiKey` and `VoiceApiKey` cascades.

### Vulnerable but not changed in this pass

- No user-facing or API-level data export route was found for conversations, personas, created characters, or keys metadata.
- No user-controlled hard-delete account route was found. Existing chat/room deletion routes archive records via `archivedAt`; that is not equivalent to account-level hard delete.
- `LlmRequestLog.userId` uses `onDelete: SetNull`. If account hard delete is implemented, decide whether these logs should be deleted or further anonymized before deleting the user, especially because they retain `chatId` strings and provider/model metadata.

### Requires product/security decision

- Adding export and account-delete endpoints would be a user-facing feature change, which was explicitly out of scope for this defensive pass. Implement these in a dedicated data-rights pass with confirmation UX, abuse protection, and tests proving rows are actually removed from the database.

## Validation

Commands run after changes:

```text
npx tsx --test tests/security-secrets.test.ts tests/security-auth-rate-limit.test.ts tests/security-authorization.test.ts tests/security-input-validation.test.ts tests/security-http.test.ts tests/message-actions.test.ts tests/provider-fallback-chain.test.ts tests/character-lorebook-visual.test.ts tests/character-model-settings.test.ts tests/character-model-privacy.test.ts tests/rooms-voice-webgl.test.ts
```

Result: passed, 30/30 tests.

```text
npm run typecheck
```

Result: passed.

```text
npm run lint
```

Result: passed, no ESLint warnings or errors.

```text
npm run build
```

Result: passed. Build completed successfully.

```text
npm audit
```

Result: failed because 8 known vulnerabilities remain and all available fixes require breaking/range-crossing upgrades.

Full current `npm audit` output:

```text
# npm audit report

glob  10.2.0 - 10.4.5
Severity: high
glob CLI: Command injection via -c/--cmd executes matches with shell:true - https://github.com/advisories/GHSA-5j98-mcp5-4vw2
fix available via `npm audit fix --force`
Will install eslint-config-next@16.2.10, which is a breaking change
node_modules/glob
  @next/eslint-plugin-next  14.0.5-canary.0 - 15.0.0-rc.1
  Depends on vulnerable versions of glob
  node_modules/@next/eslint-plugin-next
    eslint-config-next  14.0.5-canary.0 - 15.0.0-rc.1
    Depends on vulnerable versions of @next/eslint-plugin-next
    node_modules/eslint-config-next

next  9.3.4-canary.0 - 16.3.0-canary.5
Severity: high
Next.js self-hosted applications vulnerable to DoS via Image Optimizer remotePatterns configuration - https://github.com/advisories/GHSA-9g9p-9gw9-jx7f
Next.js HTTP request deserialization can lead to DoS when using insecure React Server Components - https://github.com/advisories/GHSA-h25m-26qc-wcjf
Next.js: HTTP request smuggling in rewrites - https://github.com/advisories/GHSA-ggv3-7p47-pfv8
Next.js: Unbounded next/image disk cache growth can exhaust storage - https://github.com/advisories/GHSA-3x4c-7xq6-9pq8
Next.js has a Denial of Service with Server Components - https://github.com/advisories/GHSA-q4gf-8mx6-v5v3
Next.js Vulnerable to Denial of Service with Server Components - https://github.com/advisories/GHSA-8h8q-6873-q5fj
Next.js's Middleware / Proxy redirects can be cache-poisoned - https://github.com/advisories/GHSA-3g8h-86w9-wvmq
Next.js vulnerable to cross-site scripting in App Router applications using CSP nonces - https://github.com/advisories/GHSA-ffhc-5mcf-pf4q
Next.js vulnerable to cache poisoning via collisions in React Server Component cache-busting - https://github.com/advisories/GHSA-vfv6-92ff-j949
Next.js has cross-site scripting in beforeInteractive scripts with untrusted input - https://github.com/advisories/GHSA-gx5p-jg67-6x7h
Next.js has a Denial of Service in the Image Optimization API - https://github.com/advisories/GHSA-h64f-5h5j-jqjh
Next.js vulnerable to server-side request forgery in applications using WebSocket upgrades - https://github.com/advisories/GHSA-c4j6-fc7j-m34r
Next.js vulnerable to cache poisoning in React Server Component responses - https://github.com/advisories/GHSA-wfc6-r584-vfw7
Next.js has a Middleware / Proxy bypass in Pages Router applications using i18n - https://github.com/advisories/GHSA-36qx-fr4f-26g5
Depends on vulnerable versions of postcss
fix available via `npm audit fix --force`
Will install next@16.2.10, which is a breaking change
node_modules/next

next-auth  <=0.0.0-semantically-released || 1.1.0 - 1.5.0 || 2.0.0-beta.0 - 4.24.12 || 5.0.0-beta.0 - 5.0.0-beta.30
Severity: moderate
Depends on vulnerable versions of @auth/core
NextAuthjs Email misdelivery Vulnerability - https://github.com/advisories/GHSA-5jpx-9hw9-2fx4
Depends on vulnerable versions of nodemailer
fix available via `npm audit fix --force`
Will install next-auth@5.0.0-beta.31, which is outside the stated dependency range
node_modules/next-auth

nodemailer  <=9.0.0
Severity: high
Nodemailer: Email to an unintended domain can occur due to Interpretation Conflict - https://github.com/advisories/GHSA-mm7p-fcc7-pg87
Nodemailer’s addressparser is vulnerable to DoS caused by recursive calls - https://github.com/advisories/GHSA-rcmh-qjqh-p98v
Nodemailer has SMTP command injection due to unsanitized `envelope.size` parameter - https://github.com/advisories/GHSA-c7w3-x93f-qmm8
Nodemailer Vulnerable to SMTP Command Injection via CRLF in Transport name Option (EHLO/HELO)  - https://github.com/advisories/GHSA-vvjj-xcjg-gr5g
Nodemailer: CRLF injection in Nodemailer List-* header comments allows arbitrary message header injection - https://github.com/advisories/GHSA-268h-hp4c-crq3
Nodemailer jsonTransport bypasses disableFileAccess and disableUrlAccess during message normalization - https://github.com/advisories/GHSA-wqvq-jvpq-h66f
Nodemailer: Improper TLS Certificate Validation in OAuth2 Token Fetch Enables Credential Interception - https://github.com/advisories/GHSA-r7g4-qg5f-qqm2
Nodemailer: Message-level raw option bypasses disableFileAccess/disableUrlAccess, enabling arbitrary file read and full-response SSRF in the delivered message - https://github.com/advisories/GHSA-p6gq-j5cr-w38f
fix available via `npm audit fix --force`
Will install nodemailer@9.0.3, which is a breaking change
node_modules/nodemailer
  @auth/core  <=0.34.2 || 0.35.0 - 0.41.0
  Depends on vulnerable versions of nodemailer
  node_modules/@auth/core

postcss  <8.5.10
Severity: moderate
PostCSS has XSS via Unescaped </style> in its CSS Stringify Output - https://github.com/advisories/GHSA-qx2v-qp2m-jg93
fix available via `npm audit fix --force`
Will install next@16.2.10, which is a breaking change
node_modules/next/node_modules/postcss

8 vulnerabilities (3 moderate, 5 high)

To address all issues (including breaking changes), run:
  npm audit fix --force
```

## Branch and Deployment Confirmation

- Local branch: `main`.
- Local `HEAD`: `e99e3905525d5682f3e1df7a19d326ea605f9da7`.
- `origin/main`: `e99e3905525d5682f3e1df7a19d326ea605f9da7`.
- This hardening work is currently uncommitted local working-tree code on `main`.
- Vercel project inspection confirmed project `nythera`, root directory `.`, and build command `npm run build`.
- Latest inspected production deployment: `https://nythera-h2qjyi1vc-christopherstalkers-projects.vercel.app`, target `production`, status `Ready`, alias `https://nythera-ai-character-platform.vercel.app`.
- The inspected Vercel CLI metadata did not expose the Git branch/commit for that deployment, and this hardening work has not been deployed.
