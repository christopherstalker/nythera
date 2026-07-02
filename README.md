# Nythera

![Nythera](./public/og-image-v3.png)

> A BYOK AI roleplay platform for building persistent characters, private personas, and model-flexible conversations without locking users into one hosted model.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/christopherstalker/nythera)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)

---

## What is Nythera

Nythera is an AI character roleplay platform for people who want more control over their characters, model providers, and long-running story context. It combines character creation, user personas, memory, chat branching, rooms, voice keys, and encrypted bring-your-own-key model access in one Next.js application.

Unlike platforms that bind every conversation to a single hosted model, Nythera lets users connect their own OpenAI, Anthropic, Gemini, or OpenAI-compatible provider keys while keeping saved secrets off the browser.

[SCREENSHOT]

## Key features

### BYOK and model freedom

- Encrypted per-user provider keys for OpenAI, Anthropic, Gemini, and OpenAI-compatible APIs.
- First-class provider presets for OpenAI, Anthropic, Gemini, DeepSeek, Mistral, Groq, and xAI.
- Per-chat model and response instruction controls.
- Optional fallback ordering across saved providers.

### Character creation

- Prompt-based generation, simple mode, and custom editing paths.
- Character persona, scenario, greeting, lorebook, visual identity, safety, and sampling settings.
- Public, unlisted, and private visibility with moderation checks before public discovery.
- Character ratings, likes, reports, remixes, and library views.

### Conversation and memory

- Streaming character chat with token/cost metadata when provider usage is available.
- User persona profiles that can be bound to chat context.
- Long-term memory storage and semantic retrieval with pgvector.
- Branching, rewind, regenerate, continue, pin, and share flows.

### Platform surface

- Auth.js sign-in with credentials plus configurable OAuth providers.
- PWA install/update support and a Windows desktop download surface.
- Admin report review APIs and moderation views.
- Mobile API routes for companion clients.

## Tech stack

| Layer | Tools |
| --- | --- |
| App | Next.js 14 App Router, React 18, TypeScript |
| Styling | Tailwind CSS, custom design tokens, lucide-react |
| Auth | Auth.js / NextAuth v5, Prisma adapter |
| Data | PostgreSQL, Prisma, pgvector |
| AI | OpenAI, Anthropic, Gemini, OpenAI-compatible provider gateway |
| Jobs and cache | BullMQ, Redis, Upstash Redis |
| Deployment | Vercel, optional Express proxy service |

## Getting started

### Prerequisites

- Node.js 18+
- PostgreSQL with pgvector available
- Redis if you want background jobs instead of inline fallbacks
- At least one provider API key for live model responses

### Installation

```bash
git clone https://github.com/christopherstalker/nythera.git
cd nythera
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000`, create an account, then add a provider key in Settings.

### Environment variables

| Variable | Description | Example/default | Required |
| --- | --- | --- | --- |
| `DATABASE_URL` | Prisma PostgreSQL connection string. | `postgresql://postgres:postgres@localhost:55433/roleplay?schema=public` | Yes |
| `DIRECT_URL` | Direct database connection for migrations. | Same as `DATABASE_URL` locally | Yes |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Auth.js session secret. | `change-me` | Yes |
| `AUTH_URL` / `NEXTAUTH_URL` | App URL for auth callbacks. | `http://localhost:3000` | Yes |
| `MOBILE_AUTH_SECRET` | Secret for mobile API token signing. | `change-me-mobile-token-secret` | Mobile API |
| `INTERNAL_API_TOKEN` | Internal service boundary token for proxy calls. | `change-me-internal-token` | Production |
| `LLM_PROXY_URL` | Optional external LLM proxy endpoint. | Empty on Vercel | No |
| `GEMINI_API_KEY` | Optional server-side Gemini fallback key. | Empty | No |
| `REDIS_URL` | Redis URL for BullMQ jobs. | `redis://localhost:6380` | Jobs |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash rate-limit backend. | Empty | Production recommended |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials. | Empty | OAuth only |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord OAuth credentials. | Empty | OAuth only |
| `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` | X OAuth credentials. | Empty | OAuth only |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth credentials. | Empty | OAuth only |
| `EMAIL_SERVER` / `EMAIL_FROM` | Email sign-in transport and sender. | Empty / `noreply@example.com` | Email auth |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT` | Optional object storage settings. | Empty | No |
| `SENTRY_DSN` | Optional Sentry project DSN. | Empty | No |

## Provider support

| Provider | API format | Setup status |
| --- | --- | --- |
| OpenAI | Native OpenAI | First-class preset |
| Anthropic | Native Anthropic | First-class preset |
| Gemini | Native Gemini | First-class preset and optional server fallback |
| DeepSeek | OpenAI-compatible | First-class preset |
| Mistral | OpenAI-compatible | First-class preset |
| Groq | OpenAI-compatible | First-class preset |
| xAI | OpenAI-compatible | First-class preset |
| OpenRouter, LM Studio, Ollama-compatible gateways, vLLM, and similar endpoints | OpenAI-compatible | Custom provider entry |

## Contributing

Open an issue for bugs or focused proposals before starting broad changes. Pull requests should keep behavior changes scoped, include tests or clear verification steps, and include screenshots whenever visual output changes.

Use `fix/description` or `feat/description` branch names and conventional commit prefixes such as `fix:`, `feat:`, `chore:`, and `docs:`.

## License

No open-source license has been published for this repository yet. Until a license file is added, all rights are reserved by the repository owner.
