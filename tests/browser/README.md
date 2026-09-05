# Workspace UX checks

Run the app on port 3000, then start the isolated browser fixtures:

```powershell
node tests/browser/workspace-fixtures.mjs
```

Open http://127.0.0.1:3100. This server serves the actual application assets with synthetic characters, chats, rooms and profile responses. It intercepts every `/api/` request and strips credentials from upstream page requests. It never forwards API mutations to the application database.

Server-authenticated pages such as Settings still require a real local session and redirect to sign-in on this fixture server.

For a failed request, create `output/workspace-ux/scenario.json`:

```json
{ "failPath": "/api/profile", "method": "PATCH" }
```

Replace its contents with `{}` to restore successful responses. Fixture changes reset when the server restarts.

Check these interactions at desktop and mobile widths:

- Chats: search by character and title, no-match feedback, clear search and open a conversation.
- Library: favorites and ownership filters, result counts, no-match reset.
- Rooms: selected cast survives search, removable chips, two-character minimum, six-character maximum, failed creation preserves selection.
- Account: saving is disabled without changes, failed save preserves edits, retry succeeds, cancelling edits requires confirmation.
- Character editor: mobile section selector scrolls to the chosen section.
- Chat: compact navigation, menu focus, Escape dismissal and return to chats.

Use a signed-in local session to verify Settings search and subsection navigation. Screenshots captured from this server use synthetic content, not production account data.
