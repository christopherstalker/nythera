import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { localModelSchema } from "../src/lib/local-model";

const require = createRequire(import.meta.url);
class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

test("Studio routes isolate private characters and run cloud or local previews without chat writes", async () => {
  let authenticated = true;
  let ownsCharacter = true;
  let cloudRequests = 0;
  let characterReads = 0;
  const source = await readFile(new URL("../src/app/api/characters/[id]/test-scene/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports: { POST?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> } = {};
  const mocks: Record<string, unknown> = {
    zod: require("zod"),
    "@/lib/local-model": { localModelSchema },
    "@/lib/api": {
      HttpError,
      json: Response.json,
      requireUser: async () => {
        if (!authenticated) throw new HttpError(401, "Authentication required.");
        return { id: "owner", defaultTemperature: 0.7, maxOutputTokens: null };
      },
      parseJson: async (request: Request, schema: { parse: (value: unknown) => unknown }) =>
        schema.parse(await request.json()),
      routeError: (error: Error) =>
        Response.json({ error: error.message }, { status: error instanceof HttpError ? error.status : 400 })
    },
    "@/lib/prisma": {
      prisma: {
        character: {
          findFirst: async ({ where }: { where: { creatorId: string } }) => {
            assert.equal(where.creatorId, "owner");
            characterReads++;
            return ownsCharacter ? { id: "character", updatedAt: new Date(0) } : null;
          }
        }
      }
    },
    "@/lib/adult-consent": { requireAdultConsent: () => {} },
    "@/lib/rate-limit": { enforceRateLimit: async () => {} },
    "@/lib/user-keys": { getDecryptedProviderKeys: async () => [{ provider: "connected", defaultModel: "test" }] },
    "@/lib/character-model-settings": {
      resolveCharacterModelSettings: () => ({ model: "connected:test", temperature: 0.7 })
    },
    "@/lib/provider-model-options": { userPreferredModelValue: () => "connected:test" },
    "@/lib/prompt-assembly": {
      assembleNytheraPrompt: (input: { recentMessages: unknown[]; memories: unknown[]; currentMessage: string }) => {
        assert.deepEqual(JSON.parse(JSON.stringify(input.recentMessages)), []);
        assert.deepEqual(JSON.parse(JSON.stringify(input.memories)), []);
        return [{ role: "user", content: input.currentMessage }];
      }
    },
    "@/lib/prompts/buildPrompt": { buildPromptAddonLayers: () => ({ modeStyle: "realism" }) },
    "@/lib/chat-mode": { normalizeChatMode: () => "realism" },
    "@/lib/prompt-budget": {
      fitPromptMessagesWithinContext: (messages: unknown[]) => ({ messages, fixedPromptTooLarge: false })
    },
    "@/lib/proxy": {
      streamLlmResponse: async function* () {
        cloudRequests++;
        yield { type: "delta", text: "A cloud test reply." };
        yield { type: "usage", model: "actual-model" };
      }
    },
    "@/lib/response-length": { resolveChatOutputTokenLimit: () => null },
    "@/lib/safety": {
      moderateText: ({ text }: { text: string }) => ({ allowed: text !== "blocked", reason: "Blocked fixture" })
    },
    "@/lib/physical-continuity": {
      createPhysicalContinuityOutputGuard: () => ({ push: (text: string) => text, flush: () => "" })
    }
  };
  vm.runInNewContext(compiled, {
    exports,
    Date,
    require: (name: string) => {
      if (!(name in mocks)) throw new Error(`Unexpected dependency ${name}`);
      return mocks[name];
    }
  });
  const send = (body: unknown) =>
    exports.POST!(
      new Request("https://nythera.test/api/characters/character/test-scene", {
        method: "POST",
        body: JSON.stringify(body)
      }),
      { params: Promise.resolve({ id: "character" }) }
    );
  authenticated = false;
  assert.equal((await send({ scene: "Hello" })).status, 401);
  assert.equal(characterReads, 0);
  authenticated = true;
  ownsCharacter = false;
  assert.equal((await send({ scene: "Hello" })).status, 404);
  assert.equal(cloudRequests, 0);
  ownsCharacter = true;
  assert.equal((await send({ scene: "" })).status, 400);
  assert.equal((await send({ scene: "blocked" })).status, 400);
  const cloud = await send({ scene: "Hello" });
  assert.equal(cloud.status, 200);
  assert.equal((await cloud.json()).model, "actual-model");
  assert.equal(cloudRequests, 1);
  const localModel = { engine: "ollama", model: "local-rp", contextWindow: 8192 };
  const prepared = await (await send({ scene: "Hello", localModel })).json();
  assert.equal(prepared.local, true);
  assert.equal(prepared.request.maxTokens, null);
  const local = await (await send({ scene: "Hello", localModel, localOutput: "A local test reply." })).json();
  assert.equal(local.content, "A local test reply.");
  assert.equal(cloudRequests, 1);
  assert.equal((await send({ scene: "Hello", localModel, localOutput: "blocked" })).status, 400);
});

test("saved context endpoint rejects another owner's chat before reading private memories", async () => {
  let owned = false;
  let traceReads = 0;
  const source = await readFile(new URL("../src/app/api/chats/[id]/context/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports: { GET?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> } = {};
  vm.runInNewContext(compiled, {
    exports,
    URL,
    require: (name: string) => {
      if (name === "@/lib/adult-consent") return { requireAdultConsent: () => {} };
      if (name === "@/lib/api")
        return {
          HttpError,
          json: Response.json,
          requireUser: async () => ({ id: "reader" }),
          routeError: (error: HttpError) => Response.json({ error: error.message }, { status: error.status })
        };
      if (name === "@/lib/prisma")
        return {
          prisma: {
            chat: {
              findFirst: async ({ where }: { where: { userId: string } }) => {
                assert.equal(where.userId, "reader");
                return owned ? { id: "chat" } : null;
              }
            },
            message: {
              findFirst: async ({ where }: { where: { chatId: string; id: string } }) => {
                traceReads++;
                assert.equal(where.chatId, "chat");
                assert.equal(where.id, "selected-reply");
                return { id: where.id, contextTrace: { snapshot: { entries: [] } } };
              }
            }
          }
        };
      throw new Error(`Unexpected dependency ${name}`);
    }
  });
  const read = () =>
    exports.GET!(new Request("https://nythera.test/api/chats/chat/context?messageId=selected-reply"), {
      params: Promise.resolve({ id: "chat" })
    });
  assert.equal((await read()).status, 404);
  assert.equal(traceReads, 0);
  owned = true;
  const response = await read();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await response.json()).messageId, "selected-reply");
});
