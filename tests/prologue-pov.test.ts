import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as prologue from "../src/lib/prologue-pov";
import * as contract from "../src/lib/character-prompt-contract";
import { buildResponsePromptLayer } from "../src/lib/response-prompt";

test("second-person prologues resolve explicit name commands independently of narrative perspective", () => {
  for (const userPersonaName of [undefined, "Alex"]) {
    assert.equal(
      prologue.renderCharacterPrologue({
        greeting: "{{char}} leaves a seat beside {{user}}.",
        characterName: "Mara | Observatory",
        communicationStyle: { prologuePov: "second" },
        userPersonaName
      }),
      `Mara leaves a seat beside ${userPersonaName ?? "you"}.`
    );
  }
});

test("third-person prologues resolve names and surnames without leaking application labels", () => {
  assert.equal(
    prologue.renderCharacterPrologue({
      greeting: "Mara leaves a seat beside {{user}} {{user_surname}}.",
      characterName: "Mara",
      communicationStyle: { prologuePov: "third" },
      userPersonaName: "Alex",
      userPersonaSurname: "Morgan"
    }),
    "Mara leaves a seat beside Alex Morgan."
  );
  assert.equal(
    prologue.renderCharacterPrologue({
      greeting: "Mara leaves a seat beside {{user}}.",
      characterName: "Mara",
      communicationStyle: { prologuePov: "third" }
    }),
    "Mara leaves a seat beside the newcomer."
  );
});

test("second person preserves explicit full-name and surname references", () => {
  assert.equal(
    prologue.renderCharacterPrologue({
      greeting: "Mara turns to {{user}} {{user_surname}}. The envelope says {{user_surname}}.",
      characterName: "Mara",
      communicationStyle: { prologuePov: "second" },
      userPersonaName: "Alex",
      userPersonaSurname: "Morgan"
    }),
    "Mara turns to Alex Morgan. The envelope says Morgan."
  );
});

test("second-person narration and named dialogue coexist in the same greeting", () => {
  for (const communicationStyle of [undefined, {}, { prologuePov: "second" }, { prologuePov: "third" }]) {
    assert.equal(
      prologue.renderCharacterPrologue({
        greeting: '{{char}} turns toward you. "{{ USER }} {{user_surname}}, come in."',
        characterName: "Mara",
        communicationStyle,
        userPersonaName: "Alex",
        userPersonaSurname: "Morgan"
      }),
      'Mara turns toward you. "Alex Morgan, come in."'
    );
  }
});

test("ordinary authored prose is preserved rather than rewritten by a placeholder renderer", () => {
  const greeting = 'Mara opens the door. "You made it."';
  assert.equal(prologue.renderCharacterPrologue({ greeting, characterName: "Mara" }), greeting);
});

test("generation and custom continuation distinguish message roles from in-world identities", () => {
  for (const pov of ["second", "third"] as const) {
    const instruction = prologue.prologuePovInstruction(pov);
    assert.match(instruction, new RegExp(`narration in ${pov} person`));
    assert.match(instruction, /takes precedence over conflicting narration/);
    assert.match(instruction, /application labels, not in-world identities/);
  }
  assert.match(
    buildResponsePromptLayer({ source: "chat", prompt: "Write in first person." }),
    /never substitute them for the active persona/
  );
});

for (const routePath of ["../src/app/api/chats/route.ts", "../src/app/api/mobile/chats/route.ts"]) {
  for (const pov of ["second", "third"] as const) {
    for (const withPersona of [false, true]) {
      test(`${routePath}: saves ${pov}-person greeting ${withPersona ? "with" : "without"} a persona`, async () => {
        const character = {
          id: "character-1",
          name: "Mara",
          greeting: "{{char}} leaves a seat beside {{user}}.",
          communicationStyle: { prologuePov: pov },
          visibility: "PUBLIC",
          moderationStatus: "APPROVED"
        };
        const user = { id: "owner", role: "USER", defaultTemperature: 0.7 };
        const persona = withPersona ? { id: "persona-1", displayName: "Alex", surname: "Morgan" } : null;
        let savedGreeting = "";
        const transaction = {
          chat: { create: async () => ({ id: "chat-1" }) },
          message: {
            create: async ({ data: message }: { data: { content: string } }) => {
              savedGreeting = message.content;
            }
          }
        };
        const modules: Record<string, unknown> = {
          "@prisma/client": { MessageRole: { ASSISTANT: "ASSISTANT" } },
          "@/lib/prisma": {
            prisma: {
              character: { findUnique: async () => character },
              user: { findUniqueOrThrow: async () => ({ chatAppearance: {} }) },
              chat: { findUnique: async () => ({ id: "chat-1" }) },
              $transaction: async (action: (tx: typeof transaction) => unknown) => action(transaction)
            }
          },
          "@/lib/api": {
            requireUser: async () => user,
            getRequestIp: () => "127.0.0.1",
            parseJson: (request: Request) => request.json(),
            json: Response.json,
            routeError: (error: unknown) => {
              throw error;
            }
          },
          "@/lib/mobile-auth": { requireMobileUser: async () => user },
          "@/lib/rate-limit": { enforceRateLimit: async () => undefined },
          "@/lib/adult-consent": { requireAdultConsent: () => undefined },
          "@/lib/character-model-settings": {
            resolveCharacterModelSettings: () => ({ model: "fixture", temperature: 0.7 })
          },
          "@/lib/provider-model-options": { userPreferredModelValue: () => null },
          "@/lib/user-keys": { getEffectiveProviderKeys: async () => [] },
          "@/lib/validation": { chatCreateSchema: {} },
          "@/lib/stories/story-foundation": { ensureStoryForChat: async () => undefined },
          "@/lib/recent-chats": {},
          "@/lib/user-persona-store": { getPreferredPersona: async () => persona },
          "@/lib/prologue-pov": prologue,
          "@/lib/character-prompt-contract": contract,
          "@/lib/chat-appearance": { normalizeChatAppearance: () => ({}) }
        };
        const exports: { POST?: (request: Request) => Promise<Response> } = {};
        const source = await readFile(new URL(routePath, import.meta.url), "utf8");
        vm.runInNewContext(
          ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
          {
            exports,
            require: (name: string) => {
              assert.ok(name in modules, name);
              return modules[name];
            }
          }
        );
        assert.ok(exports.POST);
        const response = await exports.POST(
          new Request("https://nythera.test/api/chats", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ characterId: character.id })
          })
        );
        assert.equal(response.status, 201);
        const address = withPersona ? "Alex" : pov === "second" ? "you" : "the newcomer";
        assert.equal(savedGreeting, `Mara leaves a seat beside ${address}.`);
        assert.doesNotMatch(savedGreeting, /the user|\{\{/);
      });
    }
  }
}
