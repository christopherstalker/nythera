# Pre-launch fixes — 8 September 2026

This record separates implementation from observed runtime behavior. Deployment checks are recorded separately from local checks.

## Changes

- Registration, login and password setup preserve a validated internal callback. The featured character CTA retains the character destination through authentication.
- Mobile authentication puts the form before decorative copy. Phone landscape no longer displays a blocking orientation overlay.
- Provider forms show API errors beside the submitted key, announce them through `role="alert"`, and release the pending state after network errors. Custom endpoints explicitly require public HTTPS.
- Non-chat model families are filtered from discovered models, cached suggestions and saved defaults. Chat and fallback APIs reject known incompatible models. Instruction-tuned text models remain available.
- Key verification has a dedicated rate-limit bucket.
- Chat history uses an owner-scoped cursor with pages of 200 messages. Earlier history can be loaded without mounting every message. Automatic virtual scrolling no longer requests React flushes inside lifecycle methods.
- Middleware supplies a fresh CSP nonce to Next.js and response headers. Production script policy omits `unsafe-inline` and `unsafe-eval`; styles retain inline support for React layout values. Nonce-dependent documents render dynamically.
- Homepage discloses BYOK and possible provider charges. Featured theme links are limited to tags represented by the visible catalog.
- Shared glass aliases resolve to OKLCH design tokens. Duplicate rules that disabled glass surfaces were removed. Provider/chat controls use semantic surfaces and border tokens.
- The chat side panel loads only on immersive routes. Lora is preloaded. Cormorant is self-hosted with its license and Unicode subsets for the existing reading preset; its files load only when that font is used.
- On Vercel, memory work uses the existing `after()` lifecycle by default. An external BullMQ worker remains opt-in with `BACKGROUND_JOBS_MODE=queue`. This avoids trying to reach a development Redis instance from a serverless function.

## Local evidence

| Check            | Observation                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript       | `tsc --noEmit` exited 0 after implementation.                                                                                                                                                                                        |
| ESLint           | Full repository lint exited 0 before the final verification pass.                                                                                                                                                                    |
| Regression suite | 520 tests passed, 0 failed. A proxy startup timeout in the first concurrent run passed in isolation; all 10 proxy integration tests passed.                                                                                          |
| Registration     | Browser DOM shows the original character path in the Sign in callback. At a 429 × 928 viewport, the email input begins at 619.5 px.                                                                                                  |
| CSP              | Two actual local HTTP 200 responses have different policies/nonces; each nonce occurs on the returned scripts. Cache-Control is `no-store, must-revalidate`.                                                                         |
| Rate limit       | Empty registration requests return 400 for attempts 1–10, then 429 with `Retry-After: 51`. No account is created.                                                                                                                    |
| BYOK feedback    | Submitting a dummy key without a session returns HTTP 401; the browser displays `Authentication required.` next to the field and re-enables the submit button. This verifies error presentation, not provider credential validation. |
| Virtualization   | A temporary development fixture loads 1,200 synthetic messages in six pages. At the end, 11 messages are mounted and the earlier-history button is absent. The fixture was removed before deployment.                                |
| Database probe   | Twelve concurrent read-only `SELECT 1` queries through the locally configured Prisma connection all succeed in 2,644 ms. This does not establish production capacity or connection exhaustion behavior.                              |

## Limits of verification

- Fresh signup through legal acceptance and OAuth is not executed; callback propagation is checked in the DOM and code.
- Provider-expired keys and network interruption require a controlled credential/provider test. The browser check above uses an unauthenticated request.
- The synthetic history fixture establishes bounded DOM behavior; it does not establish a long production conversation's API pagination under concurrent writes.
- `after()` tasks are bounded by the function lifetime. Durable retries across crashes require an operational external worker; that is not established by this change.
- No claim of production readiness follows from the 12-query database probe. Pool sizing and instance concurrency require deployment measurements. See [Prisma's serverless connection guidance](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections).
- Screenshots and machine output are stored outside the repository in the session's `nythera-fixes` artifact folder. Production Lighthouse figures must come from a fresh run after deployment.
