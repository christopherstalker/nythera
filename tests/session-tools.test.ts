import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { buildContextTrace } from "../src/lib/context-trace";
import { fitPromptMessagesWithinContext } from "../src/lib/prompt-budget";
import { localModelSchema } from "../src/lib/local-model";
import { sanitizePromptContext } from "../src/lib/prompt-security";

const require = createRequire(import.meta.url);
const desktop = require("../desktop/electron/local-model.cjs") as {
  localEndpoint: (engine: string) => string;
  validateGeneration: (request: unknown) => { max_tokens?: number };
  readCompletion: (
    body: ReadableStream<Uint8Array>,
    onDelta: (text: string) => void,
    signal: AbortSignal
  ) => Promise<string>;
  installLocalModelBridge: (
    ipc: { handle: (channel: string, callback: (...args: unknown[]) => unknown) => void },
    origin: string
  ) => void;
};

test("context snapshots distinguish selected and omitted records using the actual prompt", () => {
  const longLore = "The archive hides a silver compass. ".repeat(30);
  const trace = buildContextTrace({
    prompt: [
      { role: "system", content: `Mara keeps the key.\n${sanitizePromptContext(longLore, 700)}` },
      { role: "user", content: "The excluded fact only appears in dialogue." }
    ],
    memories: [
      { content: "Mara keeps the key.", pinned: true },
      { content: "The excluded fact only appears in dialogue." }
    ],
    globalMemories: [{ content: "Mara keeps the key." }],
    lorebook: {
      entries: [
        { keywords: ["archive"], text: longLore },
        { keywords: ["forest"], text: "The forest is closed." }
      ]
    },
    summary: "An older branch summary.",
    estimatedTokens: 200,
    tokenBudget: 6000,
    droppedMessages: 3,
    semanticEnabled: false
  });
  assert.equal(trace.entries.length, 5);
  assert.deepEqual(
    trace.entries.map((entry) => entry.included),
    [true, false, true, false, false]
  );
  assert.equal(trace.entries[0].reason, "Pinned fact included in this request");
  assert.equal(trace.entries[2].text, sanitizePromptContext(longLore, 700));
  assert.equal(trace.droppedMessages, 3);
});

test("local context size is honored without changing the requested output ceiling", () => {
  const fit = fitPromptMessagesWithinContext(
    [
      { role: "system", content: "Character rules." },
      { role: "user", content: "Old scene. ".repeat(2000) },
      { role: "assistant", content: "Old reply. ".repeat(2000) },
      { role: "user", content: "Continue here." }
    ],
    { contextWindow: 4096, maxOutputTokens: 500 }
  );
  assert.equal(fit.tokenBudget, 4096 - 500 - 1024);
  assert.deepEqual(
    fit.messages.map((message) => message.content),
    ["Character rules.", "Continue here."]
  );
  assert.equal(fit.fixedPromptTooLarge, false);
});

test("local engine selection cannot introduce arbitrary endpoints", () => {
  assert.equal(desktop.localEndpoint("ollama"), "http://127.0.0.1:11434/v1");
  for (const engine of ["https://example.com", "__proto__", "constructor", "http://169.254.169.254"])
    assert.throws(() => desktop.localEndpoint(engine));
  assert.equal(localModelSchema.safeParse({ engine: "ollama", model: "local-rp", contextWindow: 8192 }).success, true);
  assert.equal(localModelSchema.safeParse({ engine: "ollama", model: "local-rp", contextWindow: -1 }).success, false);
  const request = {
    engine: "ollama",
    requestId: "test-turn-123",
    model: "local-rp",
    messages: [{ role: "user", content: "Hello" }],
    temperature: 0.7,
    maxTokens: null
  };
  assert.equal(Object.hasOwn(desktop.validateGeneration(request), "max_tokens"), false);
  assert.equal(desktop.validateGeneration({ ...request, maxTokens: 500 }).max_tokens, 500);
  assert.throws(() => desktop.validateGeneration({ ...request, messages: [{ role: "tool", content: "Untrusted" }] }));
  assert.throws(() => desktop.validateGeneration({ ...request, temperature: NaN }));
});

function streamBytes(content: string, width: number) {
  const bytes = new TextEncoder().encode(content);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < bytes.length; index += width) controller.enqueue(bytes.slice(index, index + width));
      controller.close();
    }
  });
}

test("local SSE handles fragmented UTF-8, usage frames and explicit completion", async () => {
  const deltas: string[] = [];
  const answer = await desktop.readCompletion(
    streamBytes(
      'data: {"choices":[{"delta":{"content":"Привіт 🌙"}}]}\r\n\r\ndata: {"choices":[],"usage":{}}\n\ndata: [DONE]\n\n',
      3
    ),
    (text) => deltas.push(text),
    new AbortController().signal
  );
  assert.equal(answer, "Привіт 🌙");
  assert.deepEqual(deltas, [answer]);
});

test("an interrupted local stream is not treated as a finished reply", async () => {
  await assert.rejects(
    desktop.readCompletion(
      streamBytes('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n', 7),
      () => {},
      new AbortController().signal
    ),
    /before the reply completed/
  );
  await assert.rejects(
    desktop.readCompletion(streamBytes("data: [DONE]\n\n", 3), () => {}, new AbortController().signal),
    /no visible reply/
  );
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(
    desktop.readCompletion(streamBytes("data: [DONE]\n\n", 5), () => {}, cancelled.signal),
    { name: "AbortError" }
  );
});

test("desktop IPC rejects other origins and child frames before network access", async () => {
  const callbacks = new Map<string, (...args: unknown[]) => unknown>();
  desktop.installLocalModelBridge(
    {
      handle: (channel, callback) => {
        callbacks.set(channel, callback);
      }
    },
    "https://nythera.art"
  );
  const invoke = callbacks.get("local-model:models")!;
  const mainFrame = { url: "https://nythera.art.evil.test" };
  await assert.rejects(async () => invoke({ senderFrame: mainFrame, sender: { mainFrame } }, "ollama"), /Untrusted/);
  await assert.rejects(
    async () =>
      invoke(
        { senderFrame: { url: "https://nythera.art" }, sender: { mainFrame: { url: "https://nythera.art" } } },
        "ollama"
      ),
    /Untrusted/
  );
});

test("local completion enforces ownership, expiry, conflict detection and idempotence", async () => {
  const source = await readFile(new URL("../src/lib/local-generation-store.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  class HttpError extends Error {
    constructor(
      public status: number,
      message: string
    ) {
      super(message);
    }
  }
  let owner = "owner";
  let lastId = "user-turn";
  let writes = 0;
  const generation = {
    id: "generation",
    lastMessageId: "user-turn",
    expiresAt: new Date(Date.now() + 60000),
    completedMessageId: null as string | null,
    payload: {
      selection: { engine: "ollama", model: "test", contextWindow: 8192 },
      request: { temperature: 0.7 },
      trace: { version: 1 },
      persona: null,
      physicalContext: null,
      recentMessages: [],
      currentMessage: "Hello",
      temporaryPersonaId: null
    } as unknown
  };
  const assistant = { id: "saved-reply", content: "Hello back" };
  const tx = {
    $queryRaw: async () => [],
    chat: {
      findFirst: async ({ where }: { where: { userId: string } }) =>
        where.userId === owner ? { id: "chat", character: {}, temporaryPersonaId: null } : null,
      update: async () => ({})
    },
    localGeneration: {
      findFirst: async () => generation,
      update: async ({ data }: { data: { completedMessageId: string; payload: unknown } }) =>
        Object.assign(generation, data)
    },
    message: {
      findFirst: async () => ({ id: lastId, sequence: 4 }),
      findUnique: async () => assistant,
      count: async () => 5,
      create: async () => {
        writes++;
        return assistant;
      }
    }
  };
  const exports: {
    completeLocalGeneration?: (input: {
      userId: string;
      chatId: string;
      generationId: string;
      content: string;
    }) => Promise<unknown>;
  } = {};
  vm.runInNewContext(compiled, {
    exports,
    Date,
    require: (name: string) => {
      if (name === "server-only" || name === "@prisma/client") return {};
      if (name === "@/lib/prisma")
        return { prisma: { $transaction: (run: (client: typeof tx) => unknown) => run(tx) } };
      if (name === "@/lib/api") return { HttpError };
      if (name === "@/lib/safety") return { moderateText: () => ({ allowed: true }) };
      if (name === "@/lib/physical-continuity")
        return { createPhysicalContinuityOutputGuard: () => ({ push: (text: string) => text, flush: () => "" }) };
      throw new Error(`Unexpected dependency: ${name}`);
    }
  });
  const complete = () =>
    exports.completeLocalGeneration!({
      userId: "owner",
      chatId: "chat",
      generationId: "generation",
      content: "Hello back"
    });
  owner = "someone-else";
  await assert.rejects(complete(), /Chat not found/);
  owner = "owner";
  generation.expiresAt = new Date(0);
  await assert.rejects(complete(), /expired/);
  generation.expiresAt = new Date(Date.now() + 60000);
  lastId = "newer-turn";
  await assert.rejects(complete(), /conversation changed/);
  lastId = "user-turn";
  assert.equal(await complete(), assistant);
  assert.equal(await complete(), assistant);
  assert.equal(writes, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(generation.payload)), {});
});
