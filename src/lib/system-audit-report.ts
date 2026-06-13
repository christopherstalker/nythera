/*
System Audit Report - 2026-06-13

Architecture:
- Next.js app routes own the product UI, auth pages, admin, character discovery/profile, create flow, settings, and chat view.
- API routes under src/app/api provide character CRUD, chat CRUD, message pagination, streaming chat, memory search, key management, auth, moderation reports, and an internal LLM proxy route.
- The LLM path is server-only: chat stream route -> prompt assembly -> get decrypted/server provider keys -> built-in gateway or INTERNAL_API_TOKEN-protected external proxy.
- Prisma persists users, characters, chats, messages, memories, reports, LLM request logs, and encrypted user model keys.
- A pgvector-backed Memory model exists, but memory extraction and retrieval were only partially wired and not strongly structured.

Verified Findings:
- Chat messages are persisted, but chat restore was capped at 80 messages and prompt short-term context was capped at 20 messages.
- Streaming appends a user message before model generation and assistant message after generation, but partial-stream error persistence and client error parsing needed hardening.
- The proxy does not expose decrypted provider keys to the browser; /api/keys returns only metadata and last4.
- Gemini routing exists through BYOK provider keys, but there was no server-managed GEMINI_API_KEY fallback.
- LLM request logs existed, but latency and failure states were incomplete.
- Prompt assembly was centralized, but persona data was unstructured and the requested deterministic section order was not explicit.

Implementation Targets:
- Add persistent structured character persona and inject it into every LLM prompt.
- Expand short-term context to 40 messages and retrieve top semantic long-term memories.
- Store structured memory candidates after assistant responses with dedupe and embeddings.
- Restore full chat history for chat switching, add explicit lastActiveAt, improve title generation, and reduce duplicate message risk.
- Add immersive avatar-derived chat background without reducing message readability.
- Add server-side Gemini env fallback, deterministic proxy prompt assembly, safer SSE parsing, latency/error logging, and large seed dataset.
*/

export {};
