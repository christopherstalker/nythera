# Nythera Phase 0 Design System Foundation

Date: 2026-06-21  
Status: Approved design  
Scope: Visual and interaction foundation only

## Context

Nythera currently mixes CSS custom properties, HSL-based Tailwind mappings, raw hex/RGB values, arbitrary radii, and component-local transition timings. It already has dark/light themes, responsive tablet fixes, and several glass-like surfaces, but no enforceable design-system contract. Phase 0 establishes that contract before later glass, bento, motion, and character-identity work.

The selected visual direction is **Aurora Ink** with **Space Grotesk** and **Cloud Soft** geometry. Both dark and light themes are first-class. Nythera remains the product name.

## Goals

- Make semantic OKLCH tokens the single source of truth for color.
- Define reusable spacing, radius, type, elevation, glass-effect, and motion tokens.
- Self-host a variable font through `next/font/local`.
- Provide a shared, SSR-safe reduced-motion contract.
- Preserve existing mobile/tablet behavior and feature functionality.
- Document the system in a concise repository reference.
- Create the foundation without redesigning every feature screen in this phase.

## Non-goals

- No provider, BYOK, API proxy, database, Prisma, or authentication changes.
- No Phase 1 glass rollout, Phase 2 bento layout, Phase 3 component animation, or Phase 4 character theming.
- No global visual rewrite of all existing feature surfaces.
- No new reference application route; the committed documentation is the Phase 0 reference.
- No Phase 5 WebGL, Rive, or Lottie work.

## Architecture

### Token layers

The design system uses three layers:

1. **Primitive tokens** define raw OKLCH channels, spacing steps, radii, type sizes, and effect values.
2. **Semantic tokens** map primitives to roles such as canvas, surface, text, border, and accent for each theme.
3. **Compatibility aliases** preserve current custom-property names while feature components migrate in their owning phases.

The intended files are:

- `src/styles/design-tokens.css`: primitive, semantic, dark/light, typography, elevation, and effect tokens.
- `tailwind.config.ts`: semantic Tailwind mappings that consume the CSS variables.
- `src/app/globals.css`: base rules and temporary compatibility aliases, importing the token stylesheet.
- `src/app/layout.tsx`: local font registration.
- `src/lib/motion.ts`: reusable motion presets.
- `src/hooks/use-prefers-reduced-motion.ts`: shared SSR-safe motion preference hook.
- `src/assets/fonts/SpaceGrotesk-Variable.woff2`: vendored variable font.
- `src/assets/fonts/OFL.txt`: font license retained beside the asset.
- `docs/design-system.md`: short human-readable source-of-truth reference.

No API route, provider component, Prisma file, proxy service, or key-management file belongs in the Phase 0 diff.

### Tailwind contract

Tailwind color entries reference channel variables using `oklch(var(--token) / <alpha-value>)`. Components consume semantic names such as `bg-canvas`, `bg-surface`, `text-primary`, `border-default`, and `ring-focus`; they do not consume primitive palette names directly unless rendering a design-system specimen.

Existing aliases such as `--bg-base`, `--text-primary`, and `--accent-purple` remain temporarily available and resolve to the new semantic values. They are migration adapters, not a second token source.

No new design-system file may introduce raw hex, RGB, or HSL color values. Metadata colors, user-selected runtime colors, image data, and manifest assets are outside this styling rule.

## Color system

### Core Aurora Ink palette

The core accent values are:

| Token | OKLCH channels | Purpose |
|---|---|---|
| `violet-500` | `0.670 0.170 286` | Primary accent |
| `violet-600` | `0.590 0.190 286` | Pressed/strong accent |
| `mint-400` | `0.870 0.120 170` | Secondary accent and gradient endpoint |
| `mint-500` | `0.780 0.130 170` | Strong secondary/success |
| `warning-500` | `0.780 0.150 80` | Warning |
| `danger-500` | `0.650 0.200 25` | Destructive state |

Two named gradients are permitted:

- `aurora-primary`: violet 500 to mint 400.
- `aurora-ambient`: transparent violet haze over the current canvas.

Gradient foregrounds use the dark canvas text token because white text does not maintain sufficient contrast across the mint endpoint.

### Semantic theme values

| Role | Dark OKLCH channels | Light OKLCH channels |
|---|---|---|
| `canvas` | `0.115 0.027 276` | `0.965 0.012 270` |
| `surface` | `0.165 0.035 276` | `0.988 0.004 270` |
| `elevated` | `0.215 0.042 276` | `0.999 0.000 0` |
| `text-primary` | `0.960 0.012 270` | `0.220 0.040 275` |
| `text-secondary` | `0.780 0.035 270` | `0.420 0.045 275` |
| `text-muted` | `0.640 0.035 270` | `0.480 0.040 275` |
| `text-disabled` | `0.490 0.026 270` | `0.650 0.025 275` |

Borders have semantic `subtle`, `default`, `strong`, and `disabled` roles derived from each theme's text/surface channels. Their opacity is controlled through Tailwind opacity modifiers rather than duplicate color tokens.

| Border role | Dark OKLCH channels | Light OKLCH channels |
|---|---|---|
| `border-subtle` | `0.350 0.040 276` | `0.820 0.030 275` |
| `border-default` | `0.450 0.040 276` | `0.720 0.035 275` |
| `border-strong` | `0.600 0.040 276` | `0.550 0.040 275` |
| `border-disabled` | `0.280 0.025 276` | `0.880 0.015 275` |

`input` aliases `surface`; `overlay` aliases `elevated`. The primary accent is violet 500, its pressed state is violet 600, and the secondary accent is mint 400. The focus ring uses mint 400 in dark mode and violet 600 in light mode so it remains distinct from the adjacent canvas/surface.

### Verified text contrast

The following WCAG contrast ratios are calculated from the selected OKLCH values after conversion to in-gamut linear sRGB:

| Theme/text | Canvas | Surface | Elevated |
|---|---:|---:|---:|
| Dark primary | 18.15:1 | 17.19:1 | 15.66:1 |
| Dark secondary | 10.17:1 | 9.63:1 | 8.78:1 |
| Dark muted | 6.05:1 | 5.73:1 | 5.22:1 |
| Light primary | 15.70:1 | 16.80:1 | 17.34:1 |
| Light secondary | 7.70:1 | 8.23:1 | 8.50:1 |
| Light muted | 5.94:1 | 6.35:1 | 6.56:1 |

All regular text roles exceed 4.5:1 on all three foundation surfaces. Disabled text is approximately 2.80–3.25:1 and may only be used for genuinely inactive controls, not secondary information.

## Glass composition contract

Phase 0 defines glass composition without introducing `glass-surface` or `glass-border` colors. Phase 1 must compose glass from the existing semantic channels:

- Surface color: `surface` or `elevated` with a named opacity step.
- Border color: `border-default` or `border-subtle` with a named opacity step.
- Blur: named `glass-blur-sm`, `glass-blur-md`, or `glass-blur-lg` effect token.
- Saturation: named `glass-saturation` token.
- Grain: one shared noise asset and named `glass-noise-opacity` token.

This keeps glass color theme-aware and prevents component-local translucent colors. Tablet/mobile fallbacks use the same semantic surface at a higher opacity and set blur to none; they do not invent a separate fallback palette.

The permitted glass effect values are fixed in Phase 0:

| Effect token | Value |
|---|---:|
| `glass-surface-subtle` | 56% surface opacity |
| `glass-surface-standard` | 72% surface opacity |
| `glass-surface-strong` | 88% surface opacity |
| `glass-border-subtle` | 40% semantic border opacity |
| `glass-border-standard` | 60% semantic border opacity |
| `glass-border-strong` | 80% semantic border opacity |
| `glass-blur-sm` | 12px |
| `glass-blur-md` | 20px |
| `glass-blur-lg` | 28px |
| `glass-saturation` | 115% |
| `glass-noise-opacity` | 3.5% dark / 2.5% light |

Phase 1 selects among these values; it may not interpolate new opacity, blur, saturation, or grain values per component.

## Spacing and geometry

The spacing scale is `4, 8, 12, 16, 20, 24, 32, 40, 48, 64px`. Components must use these steps or a semantic alias based on them. Safe-area environment values and fluid page/container calculations are permitted because they are environmental layout inputs rather than spacing inventions.

The Cloud Soft radius scale is:

| Token | Value | Intended use |
|---|---:|---|
| `radius-compact` | 6px | Checkboxes, compact tags, small icon-button internals |
| `radius-control` | 12px | Inputs, compact buttons, dense rows |
| `radius-card` | 20px | Small cards and menus |
| `radius-surface` | 28px | Standard cards and sheets |
| `radius-panel` | 36px | Large panels and modal shells |
| `radius-full` | 9999px | Pills and circles only |

The 6px value is an intentional compact exception. General surfaces start at 12px. Later phases may not create intermediate radii.

Three named elevation tokens replace component-local shadows: `elevation-raised`, `elevation-floating`, and `elevation-glow`.

## Typography

Nythera self-hosts Space Grotesk Variable through `next/font/local`, using weights 300–700. UI usage is restricted to weights 400, 500, 600, and 700. The font asset comes from the official upstream distribution and retains its OFL license in the repository.

Space Grotesk's Latin glyphs are followed by the system fallback stack `Segoe UI`, `Roboto`, `Arial`, `sans-serif`. Cyrillic content intentionally uses that fallback stack; this was accepted with the Space Grotesk visual direction.

Named fluid styles use `clamp()`:

- `type-display`: `clamp(2.5rem, 5vw, 4.5rem)`
- `type-heading-1`: `clamp(2rem, 3.5vw, 3.25rem)`
- `type-heading-2`: `clamp(1.5rem, 2.5vw, 2.25rem)`
- `type-heading-3`: `clamp(1.25rem, 1.5vw, 1.5rem)`
- `type-body`: `clamp(0.9375rem, 0.9rem + 0.2vw, 1.0625rem)`

Caption and label styles may remain fixed because making tiny utility text fluid would reduce predictability and accessibility.

## Motion and reduced motion

Phase 0 installs the current `motion` package but does not add component animation. It exports exactly three reusable presets:

| Preset | Values | Intended use |
|---|---|---|
| `springSnappy` | stiffness 420, damping 32, mass 0.75 | Press states and compact UI |
| `springSoft` | stiffness 220, damping 28, mass 0.90 | Messages, cards, and layout movement |
| `easeStandard` | 220ms, cubic-bezier(0.2, 0, 0, 1) | Opacity/color transitions and non-spring fallback |

The shared hook wraps Motion's reduced-motion preference behind an SSR-safe boolean interface. Consumers must branch before assigning transform, scale, blur, or layout animation.

When `prefers-reduced-motion: reduce` is active:

- Translate, scale, blur, parallax, and looping ambient animation are disabled.
- State changes are immediate or use a simple non-spatial opacity change only when necessary for comprehension.
- Smooth scrolling is disabled.
- A global CSS safety net reduces legacy animation/transition duration and iteration count, while component-level logic remains the primary contract.

## Migration strategy

Phase 0 migrates the token layer and shared primitives without restyling every feature screen:

1. Add token stylesheet and semantic Tailwind mappings.
2. Add compatibility aliases for current custom properties.
3. Replace raw HSL/hex values inside the token layer and Tailwind theme configuration.
4. Update shared UI primitives where a semantic mapping is unambiguous and appearance can be preserved.
5. Leave feature-specific surfaces on compatibility aliases until their owning visual phase.
6. Reject new raw colors, radii, spacing, or motion timing in all Phase 0 additions.

Existing feature-local magic values are technical debt, not a license to add more. Each later phase must migrate every surface it touches to the canonical tokens.

## Failure and fallback behavior

- If the local font fails, the system stack preserves layout and readability.
- If Motion cannot run during server rendering, the shared preference API returns a stable no-animation-safe initial value and resolves client preference after hydration.
- Missing backdrop-filter support is irrelevant in Phase 0 and will use the semantic opaque fallback contract in Phase 1.
- No navigation or interaction may wait for design-system JavaScript to initialize.

## Verification

### Automated checks

- A token contract test verifies every required semantic token exists in both themes.
- A source test rejects raw hex/HSL/RGB values in the new token layer.
- A contrast test reproduces the matrix above and fails if primary, secondary, or muted text drops below 4.5:1 on canvas, surface, or elevated.
- Contract tests verify the exact spacing, radius, typography, glass-effect, and motion preset sets.
- Existing `npm test`, `npm run typecheck`, `npm run lint`, and production build must pass.
- A diff-scope check confirms no provider, BYOK, API proxy, Prisma, or auth files changed.

### Responsive and browser checks

The Phase 0 preview must be checked in Chromium, Firefox, and WebKit profiles at:

- iPhone-size mobile Safari profile.
- Android Chrome profile.
- iPad widths 768, 810, 834, and 1024px in portrait and landscape.
- Desktop Chrome and Firefox.

Windows-based WebKit emulation is not reported as real iOS Safari validation. The preview deployment remains marked for a real-device iPhone/iPad Safari smoke test before Phase 1 begins. Existing tablet layout behavior and minimum 44px touch targets must remain intact.

## Delivery boundaries

- Work occurs on a dedicated Phase 0 branch and commit set.
- The design document is committed before the implementation plan.
- Phase 0 is implemented, verified, preview-deployed, and explicitly confirmed before Phase 1 begins.
- Every later phase receives its own design/plan and commit set.
- Phase 5 remains deferred without explicit user sign-off.

## Acceptance criteria

Phase 0 is complete when:

1. Tailwind and CSS expose the approved Aurora Ink semantic tokens in dark and light themes.
2. The exact contrast matrix is covered by an automated test.
3. Space Grotesk is served locally through `next/font/local` with a retained license.
4. The approved spacing, Cloud Soft radius, fluid type, elevation, and glass-composition contracts are documented and testable.
5. Motion is installed and the three approved presets plus reduced-motion utility exist without adding Phase 3 animations.
6. The design-system reference is committed as the repository source of truth.
7. Existing tests, lint, typecheck, build, responsive layouts, and provider functionality remain unchanged.
