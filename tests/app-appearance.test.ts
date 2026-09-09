import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  APP_THEME_PRESETS,
  DEFAULT_APP_APPEARANCE,
  appAppearanceSchema,
  appAppearanceStyle,
  contrastRatio,
  parseAppAppearance
} from "../src/lib/app-appearance";

test("all theme presets round-trip through export/import and keep text readable", () => {
  for (const preset of APP_THEME_PRESETS) {
    const appearance = appAppearanceSchema.parse(JSON.parse(JSON.stringify(preset.appearance)));
    assert.deepEqual(appearance, preset.appearance);
    for (const background of [appearance.colors.background, appearance.colors.surface, appearance.colors.elevated]) {
      assert.ok(contrastRatio(appearance.colors.text, background) >= 4.5, `${preset.id} text`);
      assert.ok(contrastRatio(appearance.colors.muted, background) >= 4.5, `${preset.id} secondary text`);
    }
    const styles = appAppearanceStyle(appearance);
    assert.equal(styles["--codex-paper"], appearance.colors.background);
    assert.equal(styles["--bg-base"], appearance.colors.background);
    assert.equal(styles["--text-primary"], appearance.colors.text);
    assert.match(styles["--color-canvas"], /^\d+\.\d+ \d+\.\d+ \d+\.\d+$/);
  }
});

test("theme validation rejects CSS injection, external resources, unknown fields and unsupported versions", () => {
  for (const changes of [
    { version: 2 },
    { font: "url(https://example.test/font)" },
    { fontSize: 100 },
    { roundness: -1 },
    { surfaceOpacity: 0 },
    { blur: 100 },
    { density: "tiny" },
    { reduceMotion: "false" },
    { css: "body { display:none }" },
    { userId: "another-user" },
    { colors: { ...DEFAULT_APP_APPEARANCE.colors, accent: "#123456;display:none" } },
    { colors: { ...DEFAULT_APP_APPEARANCE.colors, background: "url(https://example.test)" } }
  ])
    assert.equal(appAppearanceSchema.safeParse({ ...DEFAULT_APP_APPEARANCE, ...changes }).success, false);
  for (const value of [undefined, null, {}, [], "invalid"]) assert.equal(parseAppAppearance(value), null);
});

test("custom themes retain user choices even when contrast is low", () => {
  const appearance = appAppearanceSchema.parse({
    ...DEFAULT_APP_APPEARANCE,
    colors: { ...DEFAULT_APP_APPEARANCE.colors, text: "#050C14" },
    fontSize: 20,
    roundness: 0,
    blur: 0,
    surfaceOpacity: 100,
    density: "compact"
  });
  assert.equal(contrastRatio(appearance.colors.text, appearance.colors.background), 1);
  const styles = appAppearanceStyle(appearance);
  assert.equal(styles["--app-font-size"], "20px");
  assert.equal(styles["--radius-control"], "0px");
  assert.equal(styles["--glass-blur-md"], "0px");
  assert.equal(styles["--glass-surface-standard"], "100%");
  assert.equal(styles["--app-control-padding"], "8px");
});

test("contrast uses linear sRGB and light palettes receive light native controls", () => {
  assert.equal(contrastRatio("#000000", "#FFFFFF"), 21);
  assert.equal(
    appAppearanceStyle(APP_THEME_PRESETS.find((theme) => theme.id === "paper")!.appearance).colorScheme,
    "light"
  );
  assert.equal(appAppearanceStyle(DEFAULT_APP_APPEARANCE).colorScheme, "dark");
});

type ThemeRoute = { GET(): Promise<Response>; PATCH(request: Request): Promise<Response> };

async function themeRoute() {
  let currentUser: string | null = "alice";
  const themes = new Map<string, unknown>();
  const writes: string[] = [];
  const source = await readFile(new URL("../src/app/api/settings/theme/route.ts", import.meta.url), "utf8");
  const modules: Record<string, unknown> = {
    "@prisma/client": { Prisma },
    zod: { z },
    "@/lib/app-appearance": { appAppearanceSchema, parseAppAppearance },
    "@/lib/api": {
      requireUser: async () => {
        if (!currentUser) throw new Error("Authentication required");
        return { id: currentUser };
      },
      parseJson: async (request: Request, schema: z.ZodType, limits: { maxBytes: number }) => {
        const body = await request.text();
        if (Buffer.byteLength(body) > limits.maxBytes) throw new Error("Too large");
        return schema.parse(JSON.parse(body));
      },
      json: (body: unknown, init: ResponseInit) => Response.json(body, init),
      routeError: (error: Error) =>
        Response.json(
          { error: error.message },
          { status: error instanceof z.ZodError ? 400 : error.message === "Too large" ? 413 : 401 }
        )
    },
    "@/lib/prisma": {
      prisma: {
        user: {
          findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
            appAppearance: themes.get(where.id) ?? null
          }),
          update: async ({ where, data }: { where: { id: string }; data: { appAppearance: unknown } }) => {
            writes.push(where.id);
            themes.set(where.id, data.appAppearance === Prisma.DbNull ? null : data.appAppearance);
          }
        }
      }
    }
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports,
    require: (name: string) => {
      assert.ok(name in modules, name);
      return modules[name];
    }
  });
  return {
    route: exports as ThemeRoute,
    writes,
    switchUser: (user: string | null) => {
      currentUser = user;
    }
  };
}

function saveRequest(appearance: unknown, extra = {}) {
  return new Request("http://localhost/api/settings/theme", {
    method: "PATCH",
    body: JSON.stringify({ appearance, ...extra })
  });
}

test("account themes persist independently, reset to null and never accept another user's ID", async () => {
  const fixture = await themeRoute();
  assert.deepEqual(await (await fixture.route.GET()).json(), { appearance: null });
  const saved = await fixture.route.PATCH(saveRequest(DEFAULT_APP_APPEARANCE));
  assert.equal(saved.status, 200);
  assert.equal(saved.headers.get("cache-control"), "private, no-store");
  fixture.switchUser("bob");
  assert.deepEqual(await (await fixture.route.GET()).json(), { appearance: null });
  assert.equal((await fixture.route.PATCH(saveRequest(DEFAULT_APP_APPEARANCE, { userId: "alice" }))).status, 400);
  assert.deepEqual(fixture.writes, ["alice"]);
  fixture.switchUser("alice");
  assert.deepEqual((await (await fixture.route.GET()).json()).appearance, DEFAULT_APP_APPEARANCE);
  assert.equal((await fixture.route.PATCH(saveRequest(null))).status, 200);
  assert.deepEqual(await (await fixture.route.GET()).json(), { appearance: null });
});

test("theme endpoints reject unauthenticated and invalid requests without writes", async () => {
  const fixture = await themeRoute();
  fixture.switchUser(null);
  assert.equal((await fixture.route.GET()).status, 401);
  assert.equal((await fixture.route.PATCH(saveRequest(DEFAULT_APP_APPEARANCE))).status, 401);
  fixture.switchUser("alice");
  assert.equal((await fixture.route.PATCH(saveRequest({ ...DEFAULT_APP_APPEARANCE, fontSize: 999 }))).status, 400);
  assert.equal(
    (await fixture.route.PATCH(saveRequest({ ...DEFAULT_APP_APPEARANCE, preset: "a".repeat(17000) }))).status,
    413
  );
  assert.deepEqual(fixture.writes, []);
});
