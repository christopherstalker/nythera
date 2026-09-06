import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { chatAppearanceSchema } from "../src/lib/validation";
import { chatFontFamily, DEFAULT_CHAT_APPEARANCE, normalizeChatAppearance } from "../src/lib/chat-appearance";

async function appearanceRoute({ signedIn = true, adult = true } = {}) {
  const source = await readFile(new URL("../src/app/api/settings/appearance/route.ts", import.meta.url), "utf8");
  let defaults: unknown = null;
  const chats = new Map([
    ["owned", { userId: "current-user", appearance: null as unknown }],
    ["foreign", { userId: "other-user", appearance: null as unknown }]
  ]);
  class HttpError extends Error {
    constructor(
      public status: number,
      message: string
    ) {
      super(message);
    }
  }
  const modules = {
    zod: { z },
    "@/lib/chat-appearance": { normalizeChatAppearance },
    "@/lib/validation": { chatAppearanceSchema },
    "@/lib/api": {
      HttpError,
      requireUser: async () => {
        if (!signedIn) throw new HttpError(401, "Unauthorized");
        return { id: "current-user" };
      },
      parseJson: async (request: Request, schema: z.ZodType) => schema.parse(await request.json()),
      json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
      routeError: (error: unknown) =>
        Response.json({ error: "Request rejected" }, { status: error instanceof HttpError ? error.status : 400 })
    },
    "@/lib/adult-consent": {
      requireAdultConsent: () => {
        if (!adult) throw new HttpError(403, "Consent required");
      }
    },
    "@/lib/prisma": {
      prisma: {
        user: {
          findUniqueOrThrow: async () => ({ chatAppearance: defaults }),
          update: async ({ where, data }: { where: { id: string }; data: { chatAppearance: unknown } }) => {
            assert.equal(where.id, "current-user");
            defaults = data.chatAppearance;
          }
        },
        chat: {
          findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
            const chat = chats.get(where.id);
            return chat?.userId === where.userId
              ? { ...chat, id: where.id, title: "A story", character: { name: "Elena" } }
              : null;
          },
          updateMany: async ({
            where,
            data
          }: {
            where: { id: string; userId: string };
            data: { appearance: unknown };
          }) => {
            const chat = chats.get(where.id);
            if (chat?.userId !== where.userId) return { count: 0 };
            chat.appearance = data.appearance;
            return { count: 1 };
          }
        }
      }
    }
  };
  const exports: { GET?: (request: Request) => Promise<Response>; PATCH?: (request: Request) => Promise<Response> } =
    {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports,
    URL,
    require: (name: keyof typeof modules) => modules[name]
  });
  return {
    get: (scope?: string) =>
      exports.GET!(new Request(`https://nythera.test/api/settings/appearance${scope ? `?chatId=${scope}` : ""}`)),
    save: (appearance: unknown, chatId?: string) =>
      exports.PATCH!(
        new Request("https://nythera.test/api/settings/appearance", {
          method: "PATCH",
          body: JSON.stringify({ appearance, chatId })
        })
      ),
    chats
  };
}

test("studio defaults and individual conversations persist independently", async () => {
  const route = await appearanceRoute();
  assert.equal((await route.save({ ...DEFAULT_CHAT_APPEARANCE, fontSize: 28 })).status, 200);
  assert.equal((await (await route.get()).json()).appearance.fontSize, 28);
  assert.equal((await (await route.get("owned")).json()).appearance.fontSize, DEFAULT_CHAT_APPEARANCE.fontSize);
  assert.equal((await route.save({ ...DEFAULT_CHAT_APPEARANCE, fontSize: 16 }, "owned")).status, 200);
  const response = await route.get("owned");
  assert.equal((await response.json()).appearance.fontSize, 16);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await (await route.get()).json()).appearance.fontSize, 28);
});

test("studio rejects access to another user's conversation and unauthenticated writes", async () => {
  const route = await appearanceRoute();
  assert.equal((await route.get("foreign")).status, 404);
  assert.equal((await route.save(DEFAULT_CHAT_APPEARANCE, "foreign")).status, 404);
  assert.equal(route.chats.get("foreign")?.appearance, null);
  const anonymous = await appearanceRoute({ signedIn: false });
  assert.equal((await anonymous.save(DEFAULT_CHAT_APPEARANCE)).status, 401);
});

test("invalid preferences and missing consent cannot change conversation appearance", async () => {
  const route = await appearanceRoute();
  assert.equal((await route.save({ ...DEFAULT_CHAT_APPEARANCE, fontSize: 999 }, "owned")).status, 400);
  assert.equal((await route.save({ ...DEFAULT_CHAT_APPEARANCE, scenePalette: "invalid" }, "owned")).status, 400);
  assert.equal(route.chats.get("owned")?.appearance, null);
  const restricted = await appearanceRoute({ adult: false });
  assert.equal((await restricted.get("owned")).status, 403);
  assert.equal((await restricted.save(DEFAULT_CHAT_APPEARANCE, "owned")).status, 403);
});

test("legacy appearances retain their values and generic fonts render as font families", () => {
  const legacy = normalizeChatAppearance({
    fontSize: 30,
    backgroundMode: "custom",
    backgroundUrl: "https://example.test/scene.webp"
  });
  assert.equal(legacy.scenePalette, "character");
  assert.equal(legacy.fontSize, 30);
  assert.equal(legacy.backgroundUrl, "https://example.test/scene.webp");
  assert.equal(chatFontFamily("system-ui"), "system-ui, sans-serif");
  assert.equal(chatFontFamily("Space Grotesk"), "var(--font-space-grotesk), sans-serif");
});
