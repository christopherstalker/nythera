# UI refresh — September 5, 2026

The home page now puts character search and shortcuts alongside a compact editorial introduction. The featured character has a smaller stage, linked genre chips, loading feedback, and a recoverable network error. Shared character cards replace the separate home implementation and keep descriptions visible on phones.

Desktop navigation expands to labelled links on browsing pages at 1200 px. Story routes retain the compact rail. Chats and character creation have direct desktop links. Mobile navigation labels remain visible, and active destinations expose `aria-current`. A keyboard skip link targets the main content.

Discovery keeps search, sorting, and an advanced-filter trigger in its main toolbar. Active search and tag criteria are removable above the results. Advanced controls use an inline desktop panel and a Radix dialog on smaller screens, with focus containment, Escape dismissal, focus restoration, and a Show results action. Empty searches expose a Clear filters action.

Prettier runs on changed files through pre-commit, alongside the existing lint, type, regression, and security checks. Development assets no longer receive a one-year immutable cache header. Generated output directories are excluded from TypeScript input discovery.

## Typography follow-up

Lora replaces Cormorant in editorial headings and becomes the default for chat text, at 22 px with regular weight and 1.65 line height. Both upright and italic variable fonts are served locally as WOFF2, include Cyrillic, and carry the upstream SIL Open Font License. Existing conversation font choices are preserved; Lora and Cormorant remain selectable in chat appearance.

The shell explicitly selects compact navigation on chat and room routes. It uses a 72 px icon rail with accessible link names and native hover titles. Browsing pages regain labelled navigation at 1200 px.

Browser verification confirms Lora is loaded on desktop and mobile without horizontal overflow. The chat route renders a 72 px rail with all labels hidden before the unauthenticated session redirects to sign-in; the home page restores the 208 px rail. Conversation content still requires an authenticated session for visual verification. The follow-up production build, all pre-commit hooks, and all 512 tests pass. Token assertions now tolerate equivalent CSS whitespace and decimal formatting.

## Verification

- 512 automated tests pass.
- Production build completes, including type checking and linting.
- All pre-commit hooks pass for the changed files.
- Browser checks cover home search, clearing search without leaving home, tag selection, filter reset, empty results, mobile navigation, and dialog keyboard behavior.
- No horizontal page overflow at 320, 390, 768, and 1280 px.
- No browser console warnings or errors on the inspected production pages.
- Screenshots use actual public catalog content from the local production server. The catalog returned one public character during final verification.
- Authenticated chat generation and account-only workflows were not exercised.
- The build reports an optional BullMQ `@valkey/valkey-glide` resolution warning; compilation and build completion succeed.

## Screenshots

- `output/ui-refresh/home-desktop.png`
- `output/ui-refresh/home-mobile.png`
- `output/ui-refresh/explore-desktop.png`
- `output/ui-refresh/explore-mobile.png`
- `output/ui-refresh/filters-mobile.png`
- `output/ui-refresh/lora-desktop.png`
- `output/ui-refresh/lora-mobile.png`
