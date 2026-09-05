# Contributing

Install the repository checks before making changes:

```bash
pre-commit install
```

## Local setup

```bash
git clone https://github.com/christopherstalker/nythera.git
cd nythera
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Run `npm run typecheck` and `npm run lint` before opening a pull request. Use targeted tests when changing behavior covered by `tests/`.

Pre-commit formats changed files with Prettier, runs ESLint and TypeScript, and checks for private keys, oversized files, and regressions.

## Branches

Use short, descriptive branch names:

- `fix/description`
- `feat/description`
- `docs/description`
- `chore/description`

## Commits

Use conventional commit prefixes:

- `feat:`
- `fix:`
- `chore:`
- `docs:`
- `refactor:`

## Pull request checklist

- Typecheck passes.
- Lint passes.
- No new `console.log` statements.
- No commented-out code.
- Visual changes include screenshots.
- API, database, and auth changes include clear verification notes.
