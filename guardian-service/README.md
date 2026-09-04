# Nythera Guardian

Nythera Guardian is a separately deployed control-plane service. It exercises the production AI path, records health outside the application process, and emits transition-based alerts without handling user traffic.

## Required environment

- `GUARDIAN_TARGET_URL` — production origin, such as `https://www.nythera.art`.
- `GUARDIAN_SHARED_SECRET` — at least 32 random characters; set the same value on Nythera and Guardian.
- `GUARDIAN_API_TOKEN` — separate token protecting `/v1/status` and `/v1/check`.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — recommended for durable state and distributed locking.

Optional alerts:

- `GUARDIAN_ALERT_WEBHOOK_URL`
- `GUARDIAN_TELEGRAM_BOT_TOKEN` and `GUARDIAN_TELEGRAM_CHAT_ID`

Nythera should also set `GUARDIAN_CANARY_USER_ID` to a dedicated non-admin account whose saved provider and fallback settings mirror production. `GUARDIAN_CANARY_MODEL` can override its preferred model.

## Run locally

```bash
pnpm --dir guardian-service install --frozen-lockfile
pnpm run guardian:build
pnpm run guardian:start
```

The service exposes public liveness at `/health`; detailed state and manual checks require `Authorization: Bearer <GUARDIAN_API_TOKEN>`.
