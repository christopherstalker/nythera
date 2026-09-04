# Nythera Guardian

Independent health monitor for Nythera's production AI path. It calls the protected canary endpoint through the same provider routing and fallback chain used by chat, tracks state transitions, and exposes a token-protected status API.

## Required environment

- `GUARDIAN_TARGET_URL` — production origin, for example `https://www.nythera.art`
- `GUARDIAN_SHARED_SECRET` — shared bearer secret used by the application canary endpoint
- `GUARDIAN_API_TOKEN` — bearer token for `/v1/status` and `/v1/check`

Optional durable state uses `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Optional alerts use either `GUARDIAN_ALERT_WEBHOOK_URL` or the Telegram token/chat pair.

## Endpoints

- `GET /health` — public liveness endpoint
- `GET /v1/status` — current snapshot, bearer token required
- `POST /v1/check` — run an immediate check, bearer token required

The service reports fallback as `degraded`. A hard failure first enters `degraded`, then becomes `down` after the second consecutive failed check. Recovery is reported immediately.
