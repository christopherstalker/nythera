import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

async function loadRoute(authorized: boolean) {
  const source = await readFile(new URL("../src/app/api/chats/recent-characters/route.ts", import.meta.url), "utf8");
  const queries: Array<Record<string, unknown>> = [];
  const recent = [{ id: "latest-chat", character: { id: "character-a", name: "Elena" } }];
  const modules = {
    "@/lib/prisma": {
      prisma: {
        chat: {
          findMany: async (query: Record<string, unknown>) => {
            queries.push(query);
            return recent;
          }
        }
      }
    },
    "@/lib/api": {
      requireUser: async () => {
        if (!authorized) throw new Error("unauthorized");
        return { id: "current-user" };
      },
      json: (body: unknown) => body,
      routeError: () => ({ error: "unauthorized" })
    },
    "@/lib/adult-consent": { requireAdultConsent: () => {} }
  };
  const exports: { GET?: () => Promise<unknown> } = {};
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  vm.runInNewContext(compiled.outputText, { exports, require: (name: keyof typeof modules) => modules[name] });
  return { queries, response: await exports.GET!() };
}

test("recent character chats isolate the current user and exclude archived conversations", async () => {
  const { queries, response } = await loadRoute(true);
  const query = JSON.parse(JSON.stringify(queries[0]));
  assert.deepEqual(query.where, { userId: "current-user", archivedAt: null });
  assert.deepEqual(query.distinct, ["characterId"]);
  assert.deepEqual(query.orderBy, [{ lastActiveAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }]);
  assert.equal(query.take, 12);
  assert.equal(query.select.messages, undefined);
  assert.equal((response as { chats: Array<{ id: string }> }).chats[0].id, "latest-chat");
});

test("unauthenticated sidebar requests never query chat history", async () => {
  const { queries, response } = await loadRoute(false);
  assert.equal(queries.length, 0);
  assert.deepEqual(response, { error: "unauthorized" });
});
