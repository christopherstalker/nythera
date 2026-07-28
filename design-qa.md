# Living Codex redesign — design QA

## Evidence

- Source visual truth (desktop): `C:\Users\chris\AppData\Local\Temp\codex-clipboard-177f7b52-3b6d-47e3-bad2-47905111e781.png`
- Source visual truth (mobile): `C:\Users\chris\AppData\Local\Temp\codex-clipboard-b4046840-5b77-42b0-aa6c-7ccfa8c45aa4.png`
- Implementation (desktop): `D:\Web\Roleplay\output\redesign\character-studio-desktop.png`
- Implementation (mobile): `D:\Web\Roleplay\output\redesign\character-studio-mobile.png`
- Full-view desktop comparison: `D:\Web\Roleplay\output\redesign\qa-desktop-comparison.png`
- Full-view mobile comparison: `D:\Web\Roleplay\output\redesign\qa-mobile-comparison.png`
- Additional route evidence: `D:\Web\Roleplay\output\redesign\living-index-desktop.png`
- Viewports: desktop 1488 × 1058; mobile 390 × 844.
- State: dark theme, authenticated local visual-QA session, new character in Guided mode, empty portrait before upload.
- Focused comparison: the normalized mobile comparison is the focused check for top context bar, cover/dossier proportions, chapter index, bottom navigation, typography, and rule spacing. A second crop was not needed because those details remain readable at the original 390 px implementation width.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- Typography: Cormorant Garamond carries display, manuscript, italic annotation, and dossier copy; compact uppercase labels use the product sans/monospace rhythm. Weight, line height, tracking, and hierarchy align with the editorial reference.
- Spacing and layout rhythm: desktop preserves the narrow icon rail, fixed dossier column, large manuscript field, hairline rules, margin annotations, and generous negative space. Mobile becomes a context header, cinematic dossier cover, chapter strip, sequential manuscript, and fixed product navigation without horizontal overflow.
- Colors and tokens: the canonical surface is black textured paper with warm ivory type, mint navigation/active states, and restrained violet annotations. The previous cosmic/starfield surface is no longer mounted in the product shell.
- Image quality and assets: supplied character images remain real raster assets with object-cover crops. Character Studio intentionally shows the genuine empty upload state until the creator supplies a portrait; it does not substitute a fake illustration or CSS placeholder.
- Copy and content: creation-specific language replaces chat transcript copy while preserving the reference hierarchy. All persisted character fields, AI generation, lorebook, model overrides, Character Card V2 import/export, visibility, and safety controls remain available.
- Interaction QA: Guided and Complete modes render and switch correctly; Complete exposes the six-chapter manuscript; chapter navigation is wired; browser console has no warnings or errors in the production build.

## Comparison history

### Iteration 1

- Earlier findings: the legacy cosmic background leaked through the manuscript; generic mobile theme/account controls collided with the new context bar; the fixed action dock covered the beginning of the mobile manuscript.
- Fixes: removed the cosmic backdrop from `AppShell`; limited Story Context to immersive story routes; gave Character Studio its own back/status/bookmark header; changed the mobile action footer from a viewport-fixed overlay to an in-flow sticky action leaf.
- Post-fix evidence: `qa-desktop-comparison.png` and `qa-mobile-comparison.png` show the corrected black paper surface, unobstructed mobile header, and clear manuscript transition.

## Implementation checklist

- [x] Character create and edit share one dossier/manuscript composition.
- [x] Prompt, Guided, and Complete creation paths remain functional.
- [x] Six complete-editor chapters preserve the existing data and API contract.
- [x] Shared route headers use the archive register composition.
- [x] Explore and Library character grids use ruled archival folios instead of rounded bento cards.
- [x] Desktop and mobile screenshots captured from the production build.
- [x] 163 automated tests pass.
- [x] Production build passes.

## Follow-up polish

- P3: once real creator portraits are available, an additional QA pass can tune crop focal points per character rather than relying on the current centered default.

## Living Codex branding pass — 2026-07-18

### Evidence

- Exact logo reference: `C:\Users\chris\AppData\Local\Temp\codex-clipboard-372c8fee-1416-4593-8762-577a32f48992.png`
- Desktop implementation: `D:\Web\Roleplay\output\redesign\brand-buttons-desktop.png`
- Mobile implementation: `D:\Web\Roleplay\output\redesign\brand-buttons-mobile.png`
- Focused logo comparison: `D:\Web\Roleplay\output\redesign\brand-logo-comparison.png`
- Viewports: desktop 1914 × 930; mobile 390 × 844.
- State: optimized production build, permanent dark theme, unauthenticated auth surface for stable button and mobile evidence.

### Findings

- No actionable P0, P1, or P2 mismatch remains.
- The geometric aurora mark is replaced by the ivory high-contrast serif `N` across navigation, favicon, PWA icons, Apple touch icon, and social preview.
- The final mark was optically enlarged after the first screenshot so its apparent size and rail placement match the supplied preview.
- Primary, secondary, outline, ghost, filter, tab, and message-edit actions now use the fixed Living Codex outline/low-fill treatment instead of bright gradient fills.
- Runtime light-theme and global text/accent customization controls are removed. The rendered document remains `html.dark`; favicon links resolve only to the versioned Living Codex assets.
- Desktop and mobile screenshots show the same black-paper, warm-ivory, mint-accent system without a light-theme escape hatch.

### Verification

- [x] 163 automated tests pass.
- [x] TypeScript typecheck passes.
- [x] Production build passes.
- [x] Desktop and mobile screenshots captured and visually inspected.
- [x] Browser console inspection returned no errors on the local production surface.

final result: passed

## Guided behavior controls — 2026-07-28

### Evidence

- Requested Guided chapter reference: `C:\Users\chris\AppData\Local\Temp\codex-clipboard-30a59ecf-8517-4031-9d7a-c3ecd02024c1.png`
- Requested behavior-control reference: `C:\Users\chris\AppData\Local\Temp\codex-clipboard-f657b592-1b3c-44a5-adca-97f20638faf9.png`
- Desktop implementation: `D:\Web\Roleplay\output\guided-sliders\guided-sliders-desktop.png`
- Mobile implementation: `D:\Web\Roleplay\output\guided-sliders\guided-sliders-mobile.png`
- Focused reference comparison: `D:\Web\Roleplay\output\guided-sliders\guided-sliders-comparison.png`
- Viewports: desktop 1440 × 1100; mobile 390 × 844.
- State: authenticated local visual-QA session, Guided mode, chapter 04 active.

### Findings

- No actionable P0, P1, or P2 mismatch remains.
- The explanatory copy and `Open complete manuscript` redirect are absent from Guided chapter 04.
- Humor, Romance, Seriousness, Initiative, and Roleplay intensity use the existing product slider component and the same two-column desktop rhythm as the supplied reference.
- Mobile collapses the controls into one column without horizontal overflow. The active final chapter now reserves enough bottom space that the sticky action sheet does not cover Roleplay intensity.
- Guided remains the active creation mode while the five controls are visible. Complete remains independently selectable and still exposes its six-chapter manuscript.
- The focused comparison confirms matching control order, values, two-column composition, label hierarchy, and track/thumb treatment while retaining Nythera's canonical typography and spacing.

### Interaction and runtime QA

- [x] All five Guided controls render with the expected default values: 5, 0, 5, 5, 5.
- [x] Guided source contains no call to switch to Complete from chapter 04.
- [x] Guided payload tests confirm all five values are written to the existing `communicationStyle` contract.
- [x] Complete can still be opened and Guided can be restored without losing the chapter structure.
- [x] Desktop and mobile browser screenshots captured and visually inspected.
- [x] Browser console inspection returned no warnings or errors.
- [x] 197 automated tests pass.
- [x] Production build passes.

final result: passed
