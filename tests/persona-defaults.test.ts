import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizePersonaRows } from "../src/lib/user-persona-profiles";

test("personas are normalized as first-class rows with one default and chat binding", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = await readFile(new URL("../prisma/migrations/20260628202000_multi_persona_chat_binding/migration.sql", import.meta.url), "utf8");
  const store = await readFile(new URL("../src/lib/user-persona-store.ts", import.meta.url), "utf8");
  const webRoute = await readFile(new URL("../src/app/api/user-persona/route.ts", import.meta.url), "utf8");
  const mobileRoute = await readFile(new URL("../src/app/api/mobile/user-persona/route.ts", import.meta.url), "utf8");
  const chatCreate = await readFile(new URL("../src/app/api/chats/route.ts", import.meta.url), "utf8");
  const mobileChatCreate = await readFile(new URL("../src/app/api/mobile/chats/route.ts", import.meta.url), "utf8");
  const streamRoute = await readFile(new URL("../src/app/api/chats/[id]/stream/route.ts", import.meta.url), "utf8");
  const quickPanel = await readFile(new URL("../src/hooks/use-chat-quick-panel.ts", import.meta.url), "utf8");
  const userPersonaModel = schema.match(/model UserPersona \{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(schema, /personas\s+UserPersona\[\]/);
  assert.match(schema, /personaId\s+String\?/);
  assert.match(schema, /label\s+String\?/);
  assert.match(schema, /isDefault\s+Boolean\s+@default\(false\)/);
  assert.doesNotMatch(userPersonaModel, /userId\s+String\s+@unique/);
  assert.match(migration, /DROP INDEX IF EXISTS "UserPersona_userId_key"/);
  assert.match(migration, /"UserPersona_one_default_per_user_idx"[\s\S]*WHERE "isDefault" = true/);
  assert.match(migration, /ADD CONSTRAINT "Chat_personaId_fkey"/);
  assert.match(store, /setDefaultPersona/);
  assert.match(store, /setDefaultUserPersona/);
  assert.match(webRoute, /user-persona-store/);
  assert.match(mobileRoute, /user-persona-store/);
  assert.match(schema, /lastPersonaId\s+String\?/);
  assert.match(store, /getDefaultPersonaId/);
  assert.match(store, /data: \{ lastPersonaId: persona\.id \}/);
  assert.match(store, /const shouldBecomeDefault = existingPersonas\.length === 0/);
  assert.match(webRoute, /defaultProfileId/);
  assert.match(mobileRoute, /defaultProfileId/);
  assert.match(chatCreate, /personaId: defaultPersonaId/);
  assert.match(mobileChatCreate, /personaId: defaultPersonaId/);
  assert.match(streamRoute, /chat\.persona \?\? defaultUserPersona/);
  assert.match(quickPanel, /chatId/);
});

test("chat persona overrides default persona in normalized state", () => {
  const state = normalizePersonaRows(
    [
      {
        id: "default-persona",
        label: "Default",
        displayName: "Default Name",
        avatarUrl: null,
        summary: "Default summary",
        background: null,
        traits: [],
        likes: [],
        dislikes: [],
        boundaries: [],
        isDefault: true,
        visibility: "PRIVATE"
      },
      {
        id: "chat-persona",
        label: "Scene",
        displayName: "Scene Name",
        avatarUrl: null,
        summary: "Scene summary",
        background: null,
        traits: [],
        likes: [],
        dislikes: [],
        boundaries: [],
        isDefault: false,
        visibility: "PRIVATE"
      }
    ],
    "chat-persona"
  );

  assert.equal(state.activeProfileId, "chat-persona");
  assert.equal(state.activeProfile?.displayName, "Scene Name");
  assert.equal(state.defaultProfileId, "default-persona");
  assert.equal(state.defaultProfile?.displayName, "Default Name");
});

test("persona state supports an explicit no-default selection", () => {
  const state = normalizePersonaRows([
    {
      id: "saved-persona",
      label: "Saved",
      displayName: "Saved Name",
      avatarUrl: null,
      summary: "Saved summary",
      background: null,
      traits: [],
      likes: [],
      dislikes: [],
      boundaries: [],
      isDefault: false,
      visibility: "PRIVATE"
    }
  ]);

  assert.equal(state.defaultProfileId, null);
  assert.equal(state.defaultProfile, null);
  assert.equal(state.activeProfileId, "saved-persona");
});
