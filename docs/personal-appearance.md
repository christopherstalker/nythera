# Personal appearance

`/settings/appearance` lets signed-in users choose a starting palette or adjust eight colors, interface font and size, spacing, corner roundness, panel opacity, blur, and reduced motion. Changes stay in the live preview until saved. Themes can be exported and imported as versioned JSON files, and Restore original removes the saved override.

Preferences live in `User.appAppearance`. Apply migration `20260909150000_personal_app_appearance` before running this version against an existing database. The normal deployment build applies pending Prisma migrations. Run `pnpm prisma generate` after updating the schema locally.

`GET` and `PATCH /api/settings/theme` use the authenticated user's ID and private, non-cacheable responses. The strict schema accepts bounded values and hex colors; imports and updates are limited to 16 KB. Public profile accents and per-chat Reading/Atmosphere settings remain independent.

The root layout renders saved variables before hydration. The client provider refreshes them after session changes, clears them on sign-out, and ignores responses belonging to a previous account. A failed save leaves the draft available for retry.

Validation covers schema limits, preset contrast, JSON round trips, account isolation, authentication, and reset behavior in `tests/app-appearance.test.ts`. Browser checks should cover preview before save, reload persistence, failed saves, reset, and mobile widths.
