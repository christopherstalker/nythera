# Phase 2 — Bento discovery layout

## Scope

- Replace the default horizontal discovery feed with an asymmetric grid.
- At desktop widths from 1280px, feature the first character at 2×2 and the fourth at 2×1 while keeping other cells standard.
- Below 1280px, render a clean auto-fit uniform grid with no spanning cells.
- Keep search/filter behavior, card interaction, copy, and filtered catalog results unchanged.

## Verification

- Source contract for desktop-only spans and shared loading/card geometry.
- Existing discovery/UI regressions, full test suite, typecheck, lint, and production build.
- Chromium visual and overlap checks at 390, 768, 810, 834, 1024, 1194, 1280, and 1440px; Firefox desktop smoke-test.
