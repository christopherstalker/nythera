# Velora

Production-oriented starter for a free Character.AI-style platform with bring-your-own model keys:

- Next.js 14 App Router, TypeScript, Tailwind CSS
- Auth.js/NextAuth v5 with OAuth, email magic link, and credentials support
- PostgreSQL + Prisma + pgvector memory schema
- SSE chat streaming endpoint
- Built-in Vercel server-side LLM gateway for provider API key isolation
- Optional separate Express LLM proxy service for non-Vercel deployments
- Encrypted per-user OpenAI, Anthropic, and Gemini keys
- Moderation hooks, rate limits, reports, admin review APIs
- BullMQ job scaffolding for summaries and memory extraction

## Local setup

1. Copy `.env.example` to `.env`.
2. Start Postgres with pgvector and Redis, or use hosted services.
3. Run:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The app works without platform-wide AI keys. Users add their own provider keys in Settings. On Vercel, leave `LLM_PROXY_URL` empty to use the built-in server-side gateway. For local or non-Vercel deployments, you can still run the optional Express proxy with `npm run proxy:dev` and set `LLM_PROXY_URL`.

## Safety boundary

The browser never calls provider APIs directly and never receives saved keys back. Users add provider keys inside Velora; keys are encrypted in PostgreSQL, decrypted only by the Next.js backend, and passed to the internal proxy for a single request.
