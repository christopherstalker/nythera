import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("persona surname is optional, persisted, editable, and exposed through its own template command", async () => {
  const [schema, migration, validation, store, settings, quickPanel, prompt, contract] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../prisma/migrations/20260831013000_user_persona_surname/migration.sql"),
    read("../src/lib/validation.ts"),
    read("../src/lib/user-persona-store.ts"),
    read("../src/components/settings/user-persona-settings-client.tsx"),
    read("../src/components/chat/chat-panel-tabs.tsx"),
    read("../src/lib/user-persona-prompt.ts"),
    read("../src/lib/character-prompt-contract.ts")
  ]);

  assert.match(schema, /surname\s+String\?/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "surname" TEXT/);
  assert.match(validation, /surname: z\.string\(\)\.trim\(\)\.max\(80\).*nullable/);
  assert.match(store, /surname: input\.surname\?\.trim\(\) \|\| null/);
  assert.match(settings, /Surname \(optional\)/);
  assert.match(settings, /\{\{user_surname\}\}/);
  assert.match(quickPanel, /Surname \(optional\)/);
  assert.match(prompt, /Canonical player surname/);
  assert.match(contract, /user_surname/);
});
