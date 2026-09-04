# Platform reconciliation — 2026-09-04

## Recovery points

- Original local `main`: `f66d70c` (July 18).
- Original local changes preserved in `2644690` before reconciliation.
- Remote baseline: `origin/main` at `40d8574` (September 4), 66 commits ahead of the original local branch.
- Integration branch: `codex/reconcile-platform-fixes-20260904`.

The local directory contained both unpublished features and older versions of files already fixed remotely. A clean working tree alone would not have demonstrated that those fixes were present. The reconciliation combines the remote fixes with the local feature set; it is not a deployment and does not establish which commit is currently live.

## Preserved behavior

- Remote physical-continuity enforcement, canonical conversation summaries, custom-prompt isolation, Guardian/AI Shield, signed proxy requests, provider recovery and request deadlines.
- Local password recovery, username validation, tutorial progress, character studio, additional character cast, saved tags and expanded persona fields.
- Local scene/time continuity, automatic memories, user-selected temperature and output-token settings.
- Remote character behavior sliders, prologue point of view and publication controls combined with local form validation and extended fields.
- Per-provider fallback model selection and metadata-only prompt-budget diagnostics.
- Password changes invalidate mobile sessions through the same account authentication version used by web sessions.

Legacy components and the old generated character dataset deleted remotely remain deleted in the integration. Their original local versions remain recoverable from `2644690`.

## Verification and release boundary

- Full test suite: 512 passed, none failed or skipped.
- Root pnpm dependency specifiers match `package.json`.
- Merge conflict markers and unresolved index entries checked.
- Historical SQL migration contents preserved; formatting hooks exclude immutable SQL migration files.
- Production build completed with migrations explicitly disabled (`SKIP_PRISMA_MIGRATE=1`). It emitted an optional BullMQ Valkey-module warning; the local server also reported an unavailable Redis background queue.
- All pre-commit checks passed, including ESLint, TypeScript and fast regression tests. Generated local artifacts are excluded from lint traversal.
- Headless Edge smoke checks passed for registration, login and password recovery at 1440px and 390px: HTTP 200, no uncaught page errors, no horizontal overflow, submit controls reachable by scrolling. Screenshots are in the ignored `output/reconciliation/` directory. No form was submitted.

No push, deployment or database migration was performed. The two existing invoice previews under `tmp/` were left untracked and untouched. Local environment files were not committed.

Ten migrations exist beyond the remote baseline. Before release, review them against the target database and confirm a recoverable backup. In particular, the case-insensitive username migration intentionally fails when conflicting usernames exist; the automatic-memory migration activates previously pending extracted memories. Authenticated database-backed flows and live provider behavior still need staging verification with those migrations applied.

For development, run `pre-commit install` after installing the project's dependencies. The hooks run formatting, linting, type checks, fast regression tests and basic file/security checks.
