/*
System Audit Report - 2026-06-13

Architecture Summary:
- Frontend: Next.js App Router owns public landing/explore, character profiles, chat, create-character wizard, settings/BYOK, auth, and admin moderation.
- Backend APIs: src/app/api contains character CRUD, chat CRUD, paginated messages, SSE chat streaming, profile/key management, moderation reports, auth, memory search, and an INTERNAL_API_TOKEN-protected LLM proxy endpoint.
- LLM path: chat stream route -> safety/moderation -> persona+memory prompt assembly -> effective provider keys (user BYOK plus server Gemini fallback) -> external proxy if configured, otherwise built-in gateway.
- Database: Prisma/Postgres/Neon persists users, encrypted provider keys, characters, chats, ordered messages, pgvector memories, reports, and LLM request logs.
- Memory/vector: Memory uses pgvector(1536), semantic retrieval, deterministic fallback embeddings, and post-message extraction/summarization jobs with inline fallback when Redis is unavailable.
- Streaming: SSE chunks are parsed with buffering on both proxy and client; assistant messages are persisted after generation, partial streams are preserved when possible, and request logs store latency/tokens/provider/model/fallback state.

Verified Working:
- Production pages / and /explore render with no client runtime exceptions after the guest chat-fetch hotfix.
- /api/characters returns an empty public catalog after the user requested bot deletion.
- Server-side provider keys are not returned to the browser; /api/keys exposes only metadata and last4.
- Gemini proxy validation succeeded through /api/proxy/llm using gemini-2.5-flash with streaming chunks and no fallback.
- Prompt assembly is centralized and injects system safety, authoritative persona, sanitized long-term memory, chat summary, recent history, and current user input.

Missing / Improved Components:
- Persona schema now supports archetype, initiative level, relationship dynamics including antagonist, forbidden behaviors, and stable behavioral rules.
- Prompt injection protection now detects meta-instruction attacks, adds a system security note, sanitizes memory/summary/history context, and prevents memory poisoning writes.
- Message ordering now has a nullable per-chat sequence fallback in addition to timestamp/id ordering.
- Chat background uses avatar-derived blurred imagery with low opacity, dark overlay, will-change hint, and reduced-motion-safe drift.
- Character dataset generation is restored as a file-only generator; seed import remains disabled so the DB is not repopulated automatically.

Residual Risks / Next Production Hardening:
- Memory extraction remains deterministic/rule-based; a future LLM extractor should classify memories with confidence while preserving poisoning safeguards.
- Chat summary is extractive and threshold-based; an LLM summary job can improve compression quality when queue infrastructure is stable.
- Title generation uses LLM with local fallback; it should be monitored for latency and provider cost.
- Redis worker is optional; production should configure REDIS_URL if async jobs should not run inline.
*/

export {};
