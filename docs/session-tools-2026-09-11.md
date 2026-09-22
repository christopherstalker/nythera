# Session tools · 11 September 2026

This iteration follows the requested scope: first-session setup, creator test scenes, local desktop generation, and visible reply context. Visual changes target individual controls and dialogs while retaining the existing page layouts.

## Included

- New chats offer **Start here**: reuse a connection or verify and save a provider key, choose an editable opening, and return to the composer. Provider keys use the existing encrypted BYOK flow.
- Creator Studio cards open **Test scene**. Three prompts cover an initial encounter, supplied scene facts, and player agency. An optional test persona is isolated from the account persona. Replies can be compared with a baseline while Studio remains open; review checkboxes are manual. Each run reads the latest saved character. Tests do not create chats, memories, or public activity.
- **Reply context** reads a private snapshot associated with the selected assistant message. It shows included and excluded retrieved memories, lore, recap, and estimated prompt size. It records the prepared request, not proof of model adherence; provider retries can shorten history. It does not claim to enumerate every canon or persona rule. Older replies have an explicit empty state.
- Updated Desktop supports Ollama at `127.0.0.1:11434` and LM Studio at `127.0.0.1:1234`. Users choose an installed model and the context window configured in that server. An optional LM Studio access token is held in the Electron main process for the current window session. It is never saved to browser storage or Nythera.
- Desktop performs local streaming and cancellation through narrowly scoped IPC. The server prepares context and saves completed replies. Replies are guarded and moderated before persistence. Completion is authenticated, serialized per chat, and idempotent. A changed conversation rejects stale completion. Expired preparation records are cleaned on the user's next local preparation; completed records discard their prompt payload immediately.
- Local mode retains cloud-synced history and therefore requires the Nythera server. It uses pinned, continuity, and profile memory without cloud semantic retrieval or cloud summarization. Images and companion mobile API local generation are not supported in this iteration. Local cancellation or interruption keeps partial output as an unsaved draft in the current tab.
- Dialogs support Escape, focus containment, focus restoration, scrolling, and mobile bottom-sheet placement. Chips, connection status, loading, error recovery, and stop controls follow existing theme tokens.

## Setup and release

Run `pre-commit install` after installing dependencies. The fast hook suite includes session tools and route behavior checks.

The additive migration `20260911120000_generation_tools` creates `ChatContextTrace` and `LocalGeneration`. The production build applied it successfully on 11 September 2026 at 17:07 UTC and regenerated Prisma Client. Future production builds continue to apply pending migrations through the existing build script.

Desktop version is 1.1.0 and opens the canonical `www.nythera.art` origin by default so redirects cannot invalidate the local bridge's sender checks. Windows x64 installer and portable packages were built, and their embedded product versions and packaged local bridge were checked. The copy script requires both artifacts for the current package version before replacing public downloads. An older installed desktop client cannot provide the new bridge.

The web app remains the default installation. `/download#desktop` adds direct installer and portable downloads for local generation, with the connection requirement and the settings location. The local-model settings link opens this section directly.

## Verification

- Behavioral tests cover actual context selection, bounded local context, engine allowlisting, fragmented UTF-8 SSE, interruption, cancellation, IPC sender validation, ownership, expiry, stale completion, and idempotence.
- Route tests execute the actual Studio and context route modules with isolated dependencies. They verify ownership before private reads, validation, cloud/local branching, and no chat writes for test scenes.
- `tests/browser/local-desktop-smoke.cjs` runs a hidden, sandboxed Electron window with the real preload and a temporary local model server. Discovery, Unicode streaming, cancellation, and context isolation passed. Run it with the project's Electron binary while port 11434 is free.
- `tests/browser/session-tools.mjs` uses real application components through `workspace-fixtures.mjs`. It exercises setup, baseline comparison, context inspection, local discovery and cloud switching, errors that preserve edits, focus restoration, and horizontal overflow at 1440 and 390 px. Every API mutation stays in fixture storage.
- Screenshots and machine output are in `output/session-tools`. Screenshot contents and desktop discovery are synthetic fixtures. No live paid generation was performed. Neither local server was running at verification time, so actual model inference remains to be checked with Ollama or LM Studio.

The complete regression run passed 618 tests. TypeScript, ESLint, formatting and pre-commit hooks passed. The optimized Next.js build and unpacked Windows desktop build succeeded.

## Protocol references

- [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)
- [LM Studio OpenAI compatibility](https://lmstudio.ai/docs/developer/openai-compat)
- [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)
