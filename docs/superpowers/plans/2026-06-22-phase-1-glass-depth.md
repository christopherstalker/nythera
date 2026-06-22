# Phase 1 — Depth and glass treatment

## Scope

- Add one reusable, token-driven depth treatment with a repeating grain asset.
- Apply it only to the chat Persona/Memory/Chats quick panel, character editor panels, and discovery character cards.
- Keep all existing component structure and interaction behavior unchanged.
- At widths up to 1024px, retain the semantic translucent surface but remove backdrop filtering for predictable tablet/mobile performance.

## Verification

- Source contract for scoped classes, grain asset, token use, and responsive fallback.
- Existing UI regression suite, typecheck, lint, and production build.
- Chromium checks at 390, 768, 810, 834, 1024, and 1440px plus desktop Firefox.
