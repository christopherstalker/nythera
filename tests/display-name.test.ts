import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { displayNameSchema, userDisplayName } from "../src/lib/display-name";
import { usernameSchema } from "../src/lib/username";
import { imageSourceSchema } from "../src/lib/validation";
import { parseProfileSettings, publicProfileUrl } from "../src/lib/profile-settings";
import { resolveMusicEmbed } from "../src/lib/music-embed";

async function loadModule<T>(path: string, modules: Record<string, unknown>) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const exports = {};
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  });
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: (name: string) => {
      assert.ok(name in modules, `Missing test dependency: ${name}`);
      return modules[name];
    },
    URL,
    process: { env: {} }
  });
  return exports as T;
}

test("display names allow Unicode, spaces, punctuation and emoji without changing handles", () => {
  for (const name of ["Олена Зоря", "李 明", "Zoë O’Neil", "Story Keeper ✨", "Family 👩‍👩‍👧"]) {
    assert.equal(displayNameSchema.parse(`  ${name}  `), name);
  }
  assert.equal(displayNameSchema.parse("a".repeat(60)), "a".repeat(60));
  assert.equal(publicProfileUrl("storykeeper"), "/u/storykeeper");
});

test("blank display names clear the override and legacy profiles fall back to username", () => {
  for (const name of ["", "   ", null]) assert.equal(displayNameSchema.parse(name), null);
  assert.equal(userDisplayName({ name: " Story Keeper ", username: "storykeeper" }), "Story Keeper");
  for (const name of [undefined, null, "", "  "]) {
    assert.equal(userDisplayName({ name, username: "storykeeper" }), "storykeeper");
  }
  assert.equal(userDisplayName({}), "Traveler");
});

test("display names reject oversized, multiline, hidden control and non-string inputs", () => {
  for (const name of [
    "a".repeat(61),
    "a\nb",
    "a\rb",
    "a\tb",
    "a\u0000b",
    "a\u2028b",
    "a\u202Eb",
    "a\u200Bb",
    12,
    {},
    []
  ]) {
    assert.equal(displayNameSchema.safeParse(name).success, false, JSON.stringify(name));
  }
});

type ProfileFixture = { id: string; name: string | null; username: string; email: string; profileSettings: object };
type ProfileResponse = { profile?: ProfileFixture; user?: ProfileFixture; error?: string };
type ProfileRoute = {
  PATCH(request: Request): Promise<Response>;
  GET(request: Request): Promise<Response>;
};

async function profileRoute(mobile: boolean, authorized = true) {
  let saved: ProfileFixture = {
    id: "current-user",
    name: "Original Name",
    username: "storykeeper",
    email: "fixture@example.test",
    profileSettings: {}
  };
  const updates: Array<{ where: { id: string }; data: Partial<ProfileFixture> }> = [];
  const invalidated: string[] = [];
  let usernameLookups = 0;
  const requireUser = async () => {
    if (!authorized) throw new Error("Authentication required.");
    return saved;
  };
  const route = await loadModule<ProfileRoute>(
    mobile ? "../src/app/api/mobile/profile/route.ts" : "../src/app/api/profile/route.ts",
    {
      "@prisma/client": { Prisma },
      zod: { z },
      "next/cache": { revalidateTag: (tag: string) => invalidated.push(tag) },
      "@/lib/api": {
        requireUser,
        HttpError: Error,
        parseJson: async (request: Request, schema: z.ZodType) => schema.parse(await request.json()),
        json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
        routeError: (error: Error) =>
          Response.json({ error: error.message }, { status: error instanceof z.ZodError ? 400 : 401 })
      },
      "@/lib/prisma": {
        prisma: {
          user: {
            findFirst: async () => {
              usernameLookups++;
              return null;
            },
            findUnique: async () => saved,
            update: async (query: (typeof updates)[number]) => {
              updates.push(query);
              saved = {
                ...saved,
                ...Object.fromEntries(Object.entries(query.data).filter(([, value]) => value !== undefined))
              };
              return saved;
            }
          }
        }
      },
      "@/lib/mobile-auth": { requireMobileUser: requireUser, publicMobileUser: (user: ProfileFixture) => user },
      "@/lib/profile-settings": { parseProfileSettings },
      "@/lib/validation": { imageSourceSchema },
      "@/lib/music-embed": { resolveMusicEmbed },
      "@/lib/username": { usernameSchema },
      "@/lib/display-name": { displayNameSchema }
    }
  );
  return { route, updates, invalidated, usernameLookups: () => usernameLookups };
}

const patchRequest = (body: unknown) =>
  new Request("http://localhost/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

for (const mobile of [false, true]) {
  const platform = mobile ? "mobile" : "web";
  test(`${platform} profile saves a normalized name for the signed-in user without changing username`, async () => {
    const fixture = await profileRoute(mobile);
    const response = await fixture.route.PATCH(patchRequest({ name: "  New Name ✨  ", id: "other-user" }));
    assert.equal(response.status, 200);
    const body: ProfileResponse = await response.json();
    const profile = body.profile ?? body.user;
    assert.equal(profile?.name, "New Name ✨");
    assert.equal(profile?.username, "storykeeper");
    assert.equal(fixture.updates[0].where.id, "current-user");
    assert.equal(fixture.updates[0].data.username, undefined);
    assert.equal(fixture.usernameLookups(), 0);
    assert.deepEqual(fixture.invalidated, ["public-creator-profile"]);
    const fetched: ProfileResponse = await (
      await fixture.route.GET(new Request("http://localhost/api/profile"))
    ).json();
    assert.equal((fetched.profile ?? fetched.user)?.name, "New Name ✨");
  });

  test(`${platform} partial updates retain names and explicit blank/null clears them`, async () => {
    const { route } = await profileRoute(mobile);
    for (const [patch, expected] of [
      [{ bio: "Updated biography" }, "Original Name"],
      [{ name: "  " }, null],
      [{ name: "New Name" }, "New Name"],
      [{ name: null }, null]
    ] as const) {
      const body: ProfileResponse = await (await route.PATCH(patchRequest(patch))).json();
      assert.equal((body.profile ?? body.user)?.name, expected);
      assert.equal((body.profile ?? body.user)?.username, "storykeeper");
    }
  });

  test(`${platform} rejects invalid names and unauthenticated writes before database mutation`, async () => {
    const fixture = await profileRoute(mobile);
    for (const name of ["x".repeat(61), "a\nb", "a\u202Eb", 42, { name: "nested" }]) {
      assert.equal((await fixture.route.PATCH(patchRequest({ name }))).status, 400);
    }
    assert.equal(fixture.updates.length, 0);
    assert.equal(fixture.invalidated.length, 0);
    const anonymous = await profileRoute(mobile, false);
    assert.equal((await anonymous.route.PATCH(patchRequest({ name: "New Name" }))).status, 401);
    assert.equal(anonymous.updates.length, 0);
  });
}

type Identity = { name?: string | null; username?: string | null; [key: string]: unknown };
type AuthCallbacks = {
  jwt(input: { token: Identity; trigger?: string; session?: unknown }): Promise<Identity>;
  session(input: { session: { user: Identity }; token: Identity }): { user: Identity };
};

test("auth refreshes display names from the database, ignores client identity claims, and clears stale names", async () => {
  let callbacks: AuthCallbacks | undefined;
  let databaseName: string | null = "New Name";
  let selectedName = false;
  const modules: Record<string, unknown> = {
    "next-auth": {
      default: (config: { callbacks: AuthCallbacks }) => {
        callbacks = config.callbacks;
        return {};
      }
    },
    "@auth/prisma-adapter": { PrismaAdapter: () => ({}) },
    bcryptjs: { default: {} },
    "@/lib/auth-email-provider": {},
    "@/lib/env": { env: {} },
    "@/lib/site-origin": { assertCanonicalAuthOrigin: () => {} },
    "@/lib/pwa-auth-transactions": {},
    "@/lib/username": {},
    "@/lib/prisma": {
      prisma: {
        user: {
          findUnique: async (query: { select: { name?: boolean } }) => {
            selectedName = query.select.name === true;
            return {
              id: "current-user",
              name: databaseName,
              username: "storykeeper",
              email: "fixture@example.test",
              authVersion: 0
            };
          }
        }
      }
    }
  };
  for (const provider of ["apple", "credentials", "discord", "google", "microsoft-entra-id", "twitter"]) {
    modules[`next-auth/providers/${provider}`] = { default: (config: unknown) => config };
  }
  await loadModule("../src/lib/auth.ts", modules);
  assert.ok(callbacks);
  const token = { sub: "current-user", name: "Stale Name", authVersion: 0 };
  const refreshed = await callbacks.jwt({ token, trigger: "update", session: { name: "Forged Name" } });
  assert.equal(selectedName, true);
  assert.equal(refreshed.name, "New Name");
  assert.equal(refreshed.username, "storykeeper");
  assert.equal(
    callbacks.session({ session: { user: { name: "Stale Name" } }, token: refreshed }).user.name,
    "New Name"
  );
  databaseName = null;
  const cleared = await callbacks.jwt({ token: refreshed, trigger: "update" });
  assert.equal(cleared.name, "storykeeper");
  assert.equal(callbacks.session({ session: { user: { name: "New Name" } }, token: cleared }).user.name, "storykeeper");
});
