import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeUsername, usernameValidationMessage } from "../src/lib/username";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("creator usernames are canonical, URL-safe, and reserve platform routes", () => {
  assert.equal(normalizeUsername("  Night_Owl  "), "night_owl");
  assert.equal(usernameValidationMessage("night_owl"), null);
  assert.match(usernameValidationMessage("Studio") ?? "", /reserved/i);
  assert.match(usernameValidationMessage("_night") ?? "", /start or end/i);
  assert.match(usernameValidationMessage("night__owl") ?? "", /single underscore/i);
  assert.match(usernameValidationMessage("ночь") ?? "", /lowercase letters, numbers/i);
});

test("creator studio exposes identity, publishing, and audience signals", async () => {
  const [studio, usernameRoute, profileRoute, libraryRoute, migration, navigation, accountHub] = await Promise.all([
    read("../src/components/studio/creator-studio-client.tsx"),
    read("../src/app/api/profile/username/route.ts"),
    read("../src/app/api/profile/route.ts"),
    read("../src/app/api/library/route.ts"),
    read("../prisma/migrations/20260903190000_case_insensitive_usernames/migration.sql"),
    read("../src/components/nav/navigation-items.ts"),
    read("../src/components/account/account-hub-client.tsx")
  ]);

  assert.match(studio, /Creator Studio/);
  assert.match(studio, /Unique username/);
  assert.match(studio, /Publishing checklist/);
  assert.match(studio, /Conversations/);
  assert.match(studio, /visibilityFilters/);
  assert.match(usernameRoute, /mode: "insensitive"/);
  assert.match(profileRoute, /That username is already taken/);
  assert.match(profileRoute, /P2002/);
  assert.match(libraryRoute, /moderationStatus: true/);
  assert.match(libraryRoute, /_count: \{ select: \{ chats: true \} \}/);
  assert.match(migration, /UNIQUE INDEX "user_username_lower_key"/);
  assert.match(navigation, /href: "\/account", label: "Account"/);
  assert.doesNotMatch(navigation, /href: "\/studio", label: "Studio"/);
  assert.match(accountHub, /href="\/studio"[\s\S]*Creator Studio/);
});
