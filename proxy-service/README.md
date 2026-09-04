# Independent AI Shield

An authenticated provider router deployed separately from the Next.js app. The app keeps a direct fallback when Shield fails before delivering response text. Once text is delivered, an interrupted stream is reported without starting a duplicate response.

## Deployment

Use repository-root Docker build context and `proxy-service/Dockerfile`. Health endpoint: `/health`. Internal port defaults to 4000 and respects `PORT`. The image runs as an unprivileged user.

Set `AI_SHIELD_SIGNING_SECRET` to the same random secret (at least 32 characters) on Shield and the application. Set `LLM_PROXY_URL` on the application to the HTTPS Shield origin, with no trailing slash. Render deployments refuse to start without signing enabled. Signed bodies, timestamps and one-use nonces prevent tampering and replay. Legacy bearer authentication exists only when signing is not configured.

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on Shield for shared circuit and replay state. Redis operations have an 800ms deadline. Without Redis, state is local to one Shield instance and resets on restart. Redis replay verification fails closed; the app then uses its direct fallback. Use one instance until distributed storage is configured.

Keep `RATE_LIMIT_BYPASS_USER_IDS` synchronized with the application. Signed traffic is limited per user rather than by the shared application IP. Existing 60,000-character account prompts remain supported; the internal context transport cap is 240,000 characters.

Platform provider credentials travel only in signed HTTPS request bodies or service environment variables. Personal BYOK credentials and image requests remain in the application gateway, including embeddings. Do not enable personal-key forwarding without an explicit privacy and deployment decision.

The health endpoint reports service readiness and configured security modes, not upstream provider health. Guardian remains responsible for end-to-end canary probes. Provider/key/model cooldowns open after three transient failures in two minutes; invalid credentials or insufficient balance open immediately. Empty responses trigger fallback.

Retries are bounded and inline. There is deliberately no unattended queue for interactive chat: replaying a cancelled or partly delivered generation could bill the user twice and duplicate story turns.

## Verification

From the repository root, run `node --import tsx --test tests/ai-shield.test.ts tests/proxy-openai-compatible.integration.test.ts` and `node node_modules/typescript/bin/tsc -p proxy-service/tsconfig.json`. Existing pre-commit hooks run lint, type checks and fast regression tests.
