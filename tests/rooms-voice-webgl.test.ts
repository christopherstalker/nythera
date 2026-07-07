import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("rooms and voice models are represented in Prisma schema and migration", async () => {
  const schema = await read("../prisma/schema.prisma");
  const migration = await read("../prisma/migrations/20260629133000_rooms_voice_deferred_features/migration.sql");

  for (const expected of [
    "model Room ",
    "model RoomCharacter",
    "model RoomMessage",
    "model VoiceApiKey",
    "enum RoomMessageRole",
    "rooms Room[]",
    "voiceApiKeys       VoiceApiKey[]",
    "@@unique([userId, provider])"
  ]) {
    assert.ok(schema.includes(expected), `schema missing ${expected}`);
  }

  for (const expected of [
    'CREATE TABLE IF NOT EXISTS "Room"',
    'CREATE TABLE IF NOT EXISTS "RoomCharacter"',
    'CREATE TABLE IF NOT EXISTS "RoomMessage"',
    'CREATE TABLE IF NOT EXISTS "VoiceApiKey"',
    '"authId" TEXT',
    'CREATE TYPE "RoomMessageRole"'
  ]) {
    assert.ok(migration.includes(expected), `migration missing ${expected}`);
  }
});

test("room APIs share the server engine across web and mobile routes", async () => {
  const engine = await read("../src/lib/rooms.ts");
  const webRoute = await read("../src/app/api/rooms/[id]/message/route.ts");
  const mobileRoute = await read("../src/app/api/mobile/rooms/[id]/message/route.ts");
  const roomsPage = await read("../src/app/(main)/rooms/page.tsx");
  const roomPage = await read("../src/app/(main)/room/[id]/page.tsx");

  for (const expected of [
    "export async function sendRoomMessage",
    "selectSpeaker",
    "GROUP ROOM TURN RULES",
    "createRoomMessageWithNextSequence",
    "streamLlmResponse"
  ]) {
    assert.ok(engine.includes(expected), `room engine missing ${expected}`);
  }

  assert.ok(webRoute.includes('route: "rooms:message"'));
  assert.ok(mobileRoute.includes('route: "mobile:rooms:message"'));
  assert.ok(webRoute.includes("sendRoomMessage"));
  assert.ok(mobileRoute.includes("sendRoomMessage"));
  assert.ok(roomsPage.includes("Cast builder"));
  assert.ok(roomPage.includes("Next speaker"));
  assert.ok(roomPage.includes("/api/voice/synthesize"));
});

test("voice BYOK is separate from model provider keys and never exposes encrypted secrets", async () => {
  const voiceKeys = await read("../src/lib/voice-keys.ts");
  const keyRoute = await read("../src/app/api/voice/keys/route.ts");
  const synthRoute = await read("../src/app/api/voice/synthesize/route.ts");
  const settings = await read("../src/components/settings/voice-key-settings-client.tsx");

  assert.ok(voiceKeys.includes("encryptSecret"));
  assert.ok(voiceKeys.includes("decryptSecret"));
  assert.ok(voiceKeys.includes("publicVoiceKeySelect"));
  assert.doesNotMatch(voiceKeys, /encryptedKey:\s*true/);
  assert.ok(keyRoute.includes("PlayHT requires a User ID"));
  assert.ok(synthRoute.includes('"xi-api-key"'));
  assert.ok(synthRoute.includes('"x-user-id"'));
  assert.ok(settings.includes("Voice BYOK"));
});

test("rooms remain discoverable from the rebuilt primary navigation", async () => {
  const navRail = await read("../src/components/nav/NavRail.tsx");
  const appShell = await read("../src/components/layout/AppShell.tsx");
  const ambient = await read("../src/components/ambient/cosmic-backdrop.tsx");

  assert.ok(navRail.includes('{ href: "/rooms", label: "Rooms"'));
  assert.ok(navRail.includes('top-nav-island'));
  assert.ok(navRail.includes('aria-label="Primary navigation"'));
  assert.ok(!navRail.includes('bottom-0'));
  assert.doesNotMatch(appShell, /<AuroraWebglBackground \/>/);
  assert.ok(ambient.includes("checkWebGLSupportAndCapability"));
  assert.ok(ambient.includes("SpaceBackgroundWebGL"));
  assert.ok(ambient.includes("<SpaceBackground />"));
  assert.doesNotMatch(ambient, /AuroraWebglBackground/);
});
