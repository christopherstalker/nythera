# Nythera Design System

Aurora Ink is Nythera's canonical visual foundation. Dark and light themes are both first-class. Token definitions live in `src/styles/design-tokens.css`; this reference defines how later visual phases must use them.

## Aurora Ink colors

- Canvas, surface, and elevated are semantic theme surfaces.
- Content primary, secondary, muted, and disabled are the only text roles.
- Brand uses violet as the primary accent and mint as the secondary accent.
- Use semantic Tailwind groups (`canvas`, `surface`, `elevated`, `content`, `outline`, `brand`) rather than primitive colors.
- Runtime user accents may override the primary brand channel only through the approved hex-to-OKLCH utility.
- Primary, secondary, and muted text maintain WCAG AA contrast on every foundation surface; action foregrounds are separately tested against accent and danger colors.

## Spacing and Cloud Soft radii

- Spacing: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64px.
- Radius: 6 / 12 / 20 / 28 / 36 / full.
- The 6px radius is reserved for compact controls and internal geometry. General surfaces start at 12px.
- Interactive targets are at least 44px.

## Space Grotesk typography

- Space Grotesk Variable is self-hosted at weights 300–700; UI uses 400, 500, 600, and 700.
- Display, heading 1–3, and body use named fluid tokens.
- Cyrillic falls back to Segoe UI, Roboto, Arial, then sans-serif.

## Glass composition

- Glass colors come from semantic utilities such as `surface/72` and matching `outline` opacity levels; never create glass-specific colors.
- Allowed surface opacity levels are 56%, 72%, and 88%; allowed border levels are 40%, 60%, and 80%.
- Allowed blur values are 12px, 20px, and 28px; saturation is 115%.
- Tablet/mobile fallback keeps the semantic surface, raises opacity, and removes blur.

## Motion presets

- `springSnappy` is for compact interactions.
- `springSoft` is for messages, cards, and layout movement.
- `easeStandard` is for opacity/color transitions and non-spring fallback.
- Do not create component-local durations or curves.

## Reduced motion

- Read preference through `usePrefersReducedMotion`.
- Reduced mode disables transform, scale, blur, parallax, loops, and smooth scrolling.
- State changes remain immediate and comprehensible.

## Usage rules

- Do not add raw hex, HSL, or RGB colors to design-system styling. Metadata, image data, and user-selected runtime colors are explicit exceptions.
- Do not add arbitrary spacing, radius, or motion values in new visual work.
- Later phases migrate every surface they touch and preserve mobile/tablet behavior.
- Provider/BYOK behavior is outside the visual design system.
