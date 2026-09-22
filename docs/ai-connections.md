# AI connections

Nythera exposes a Streamable HTTP MCP server at `/api/mcp`. It saves character cards through the same validation, ownership checks, moderation, language policy and cache invalidation used by the website.

## Connect an AI app

1. Open **Settings → AI connections** in Nythera and copy the connection address.
2. Add a custom MCP connection in your AI app, using that address and OAuth authentication.
3. Sign in to Nythera and review the application's return address and requested permissions.
4. Ask the app to create a character. It composes the card, calls `create_character`, and returns a link to the saved private character.

For ChatGPT, custom connection availability depends on the account and workspace. The server supports dynamic client registration (DCR), public OAuth clients (`token_endpoint_auth_method: none`), authorization code flow with mandatory S256 PKCE, resource indicators, and rotating refresh tokens. Configure DCR when the client offers a choice. Client ID metadata documents (CIMD) are not advertised by this version.

Clients that accept custom Bearer headers can use **Create a key** in connection settings. Store the key in the client's secret configuration or environment, never in a prompt, committed JSON, or URL. Send it as `Authorization: Bearer …`. Keys are shown once, expire after 90 days, and can be revoked individually. ChatGPT uses OAuth rather than these manually created keys.

The distributable plugin manifest and MCP configuration live in `integrations/nythera-characters`. The manifest targets `https://www.nythera.art/api/mcp`; deploy the server and migration before connecting that production address. For local development, use the local address shown in settings. The implementation has been tested with the official MCP client; installation and OAuth consent inside each third-party AI app still need verification after deployment.

## Tools and permissions

| Tool                       | Required permission  | Behavior                                                            |
| -------------------------- | -------------------- | ------------------------------------------------------------------- |
| `list_characters`          | `characters:read`    | Searches the owner's cards, with offset pagination.                 |
| `get_character`            | `characters:read`    | Reads an owned card and returns its URL.                            |
| `create_character`         | `characters:write`   | Creates a private card; visibility cannot be supplied.              |
| `update_character`         | `characters:write`   | Changes supplied fields; visibility and creation mode are excluded. |
| `set_character_visibility` | `characters:publish` | Changes visibility with existing publication validation.            |

All connections include read access. Keys default to read and write; publication is opt-in. Write access includes editing an already published card. Nested objects such as `persona` and `lorebook` replace the corresponding saved object, so clients should read the card first and preserve its other fields. Repeating a successful create call creates a second card.

Connections cannot access chats, model API keys, account administration, or another user's private characters. Even an administrator's connection is restricted to that administrator's own cards. There is no delete-character tool and no automatic image generation or paid model call: the connected AI supplies the card content and may attach an existing supported avatar.

## Deployment

Install dependencies, generate Prisma Client, and apply the additive migration through the project's normal deployment process:

```sh
pre-commit install
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run build
```

Use the same canonical HTTPS origin in `AUTH_URL` and `NEXTAUTH_URL`. Discovery, resource validation and connection management use that origin; a mismatched localhost/127.0.0.1 address will fail origin validation. The migration is `20260913120000_character_integrations`. It adds three tables without changing existing character records. Review other pending migrations before deployment.

The OAuth discovery endpoints are `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/api/mcp`. OAuth access tokens expire after one hour; refresh authorization lasts 30 days from consent. Refreshing rotates both credentials and does not extend that authorization period. Authorization codes expire after five minutes and can be consumed once. The database stores hashes of credentials. Revocation and account `authVersion` changes are checked on every MCP request. Expired unconsumed authorization codes may be removed by routine database maintenance.

No additional model API key is needed for this integration. Production rate limiting uses the platform's existing distributed rate-limit configuration. The transport is stateless and returns JSON responses, so it does not need sticky sessions or long-lived event streams.

## Verification

`node --import tsx --test tests/integration-policy.test.ts` runs the fast PKCE, redirect and permission checks included in pre-commit.

`tests/integration/character-mcp-flow.mjs` exercises the real HTTP endpoints with the official MCP client and PostgreSQL: sign-in, key creation, persistence, ownership isolation, scope enforcement, revocation, DCR, consent approval/denial, code replay, audience/redirect validation, refresh rotation and account invalidation. It requires a running local app, a disposable local database with the current schema, and a seeded test account with a password. Set `AUTH_URL`, `DATABASE_URL`, `TEST_EMAIL`, and `TEST_PASSWORD` in the environment, then run:

```sh
node tests/integration/character-mcp-flow.mjs
```

The integration suite creates synthetic users, cards and connections and increments the test account's `authVersion`. It refuses non-local origins or databases. Dispose of its database after testing. It never calls a model provider.

Protocol references: [OpenAI MCP server guide](https://developers.openai.com/plugins/build/mcp-server), [OpenAI OAuth guide](https://developers.openai.com/plugins/build/auth).
