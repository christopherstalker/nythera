# Production releases

Production must be reproducible from `main`. Commit and merge every feature before deploying it; a deployment replaces the application and does not inherit files from the previous release.

Run `pre-commit install` when setting up a checkout. Before publishing, run the hooks, tests and build against the complete release tree. Confirm that both MCP discovery routes, `/api/mcp`, and `/settings/connections` are included in the build.

Deploy a clean checkout of the merged commit. When using the CLI, build with production settings without assigning domains, verify the deployment, then promote it:

```sh
vercel deploy --prod --skip-domain --yes
vercel inspect <deployment-url>
vercel promote <deployment-url> --yes
```

Production deployment URLs redirect to the canonical domain. Check the build's route list before promotion, then verify the canonical endpoints after promotion:

- `/.well-known/oauth-authorization-server` returns 200 and advertises the canonical HTTPS issuer.
- `/.well-known/oauth-protected-resource/api/mcp` returns 200.
- An unauthenticated POST to `/api/mcp` returns 401 with an OAuth challenge.
- A signed-in user can open Settings → AI connections.

Retain the previous deployment URL for rollback. A rollback restores its entire application version, including its provider behavior.

## September 2026 recovery

The September 22 OpenRouter deployment was based on the September 10 Git tree and omitted features previously published outside Git. The recovery combines the full source of deployment `dpl_CZNY1s457HHgR8LmW51cfbBo7jHS` with the OpenRouter latency-routing fix from `0841301`. It restores MCP/OAuth connections, chat session tools, local-model support and AI gateway providers. Unpublished local edits are outside this recovery.
