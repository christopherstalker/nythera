import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("users can save a global maximum output-token limit in provider settings and chat tools", async () => {
  const [schema, migration, route, settings, chatInput, chatClient] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../prisma/migrations/20260824183000_user_max_output_tokens/migration.sql"),
    read("../src/app/api/keys/route.ts"),
    read("../src/components/settings/key-settings-client.tsx"),
    read("../src/components/chat/ChatInput.tsx"),
    read("../src/components/chat/chat-client.tsx")
  ]);

  assert.match(schema, /maxOutputTokens\s+Int\?/);
  assert.match(migration, /ALTER TABLE "User" ADD COLUMN "maxOutputTokens" INTEGER/);
  assert.match(route, /maxOutputTokens: z\.number\(\)\.int\(\)\.min\(128\)\.max\(4096\)\.nullable\(\)/);
  assert.match(route, /export async function PATCH/);
  assert.match(settings, /Maximum output tokens/);
  assert.match(
    settings.replace(/\s+/g, " "),
    /Leave it empty to use Nythera&apos;s automatic Short, Medium, and Long limits/
  );
  assert.match(settings, /method: "PATCH"/);
  assert.match(chatInput, /Maximum output tokens/);
  assert.match(chatInput, /onMaxOutputTokensChange/);
  assert.match(chatClient, /fetch\("\/api\/keys", \{[\s\S]*?method: "PATCH"[\s\S]*?maxOutputTokens: value/);
});

test("temperature persists as the user's default and seeds future web and mobile chats", async () => {
  const [schema, migration, validation, webCreate, mobileCreate, webUpdate, mobileUpdate, resolver] = await Promise.all(
    [
      read("../prisma/schema.prisma"),
      read("../prisma/migrations/20260824201500_user_default_temperature/migration.sql"),
      read("../src/lib/validation.ts"),
      read("../src/app/api/chats/route.ts"),
      read("../src/app/api/mobile/chats/route.ts"),
      read("../src/app/api/chats/[id]/route.ts"),
      read("../src/app/api/mobile/chats/[id]/route.ts"),
      read("../src/lib/character-model-settings.ts")
    ]
  );

  assert.match(schema, /defaultTemperature\s+Float\s+@default\(0\.7\)/);
  assert.match(
    migration,
    /ALTER TABLE "User"\s+ADD COLUMN "defaultTemperature" DOUBLE PRECISION NOT NULL DEFAULT 0\.7/
  );
  assert.match(migration, /SELECT DISTINCT ON \("userId"\)/);
  assert.match(validation, /temperature: z\.coerce\.number\(\)\.min\(0\)\.max\(2\)\.optional\(\)/);
  assert.match(webCreate, /input\.temperature \?\? character\.temperature \?\? user\.defaultTemperature/);
  assert.match(mobileCreate, /input\.temperature \?\? character\.temperature \?\? user\.defaultTemperature/);
  assert.match(webUpdate, /defaultTemperature: input\.temperature/);
  assert.match(mobileUpdate, /defaultTemperature: input\.temperature/);
  assert.match(resolver, /temperature: input\.chatTemperature/);
});

test("the saved user limit reaches web, mobile, and room model requests", async () => {
  const [web, mobile, rooms, api, mobileAuth] = await Promise.all([
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/app/api/mobile/chats/[id]/message/route.ts"),
    read("../src/lib/rooms.ts"),
    read("../src/lib/api.ts"),
    read("../src/lib/mobile-auth.ts")
  ]);

  assert.match(web, /resolveChatOutputTokenLimit\([\s\S]*?user\.maxOutputTokens/);
  assert.match(mobile, /resolveChatOutputTokenLimit\([\s\S]*?user\.maxOutputTokens/);
  assert.match(rooms, /configuredOutputTokenLimit\(effectiveSettings\.maxTokens, input\.user\.maxOutputTokens\)/);
  assert.match(api, /maxOutputTokens: true/);
  assert.match(mobileAuth, /maxOutputTokens: true/);
});

test("character creation uses a single-column layout before its manuscript becomes cramped", async () => {
  const styles = await read("../src/app/globals.css");

  assert.match(styles, /@media \(max-width: 899px\) \{[\s\S]*?\.codex-character-studio \{[\s\S]*?display: block/);
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 899px\)/);
});
