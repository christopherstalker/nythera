import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { emptyPersonaDraft, personaDraftPayload, personaProfileFromApi } from "../src/lib/user-persona-editor";
import { userPersonaSchema } from "../src/lib/validation";
import { normalizePersonaRows } from "../src/lib/user-persona-profiles";
import vm from "node:vm";
import ts from "typescript";

const legacy = {
  id: "persona-alex",
  label: "Explorer",
  displayName: "Alex",
  surname: "Vale",
  avatarUrl: null,
  summary: "Quiet and observant, with a dry sense of humor.",
  background: "Raised by the coast.",
  traits: ["Patient", "Loyal"],
  likes: ["Rain"],
  dislikes: ["Being rushed"],
  boundaries: ["Use they/them, and ask before touching; respect personal space."],
  isDefault: true,
  visibility: "PRIVATE" as const
};

test("editing a legacy persona retains its full description and structured details", () => {
  const draft = personaProfileFromApi(legacy);
  assert.equal(draft.appearance, "");
  const payload = personaDraftPayload({ ...draft, appearance: "Dark curls and a weathered coat." });
  for (const field of ["summary", "background", "traits", "likes", "dislikes", "boundaries", "surname"] as const) {
    assert.deepEqual(payload[field], legacy[field]);
  }
  assert.equal(payload.appearance, "Dark curls and a weathered coat.");
  assert.ok(userPersonaSchema.safeParse(payload).success);
});

test("appearance, personality and traits survive normalized responses and export/import validation", () => {
  const saved = { ...legacy, appearance: "Grey-green eyes and ink-stained fingers." };
  const normalized = normalizePersonaRows([saved]);
  const draft = personaProfileFromApi(normalized.activeProfile!);
  const imported = userPersonaSchema.parse(JSON.parse(JSON.stringify(personaDraftPayload(draft))));
  assert.equal(imported.appearance, saved.appearance);
  assert.equal(imported.summary, saved.summary);
  assert.deepEqual(imported.traits, saved.traits);
});

test("optional appearance remains absent for older clients and lists are never silently truncated", () => {
  assert.equal(userPersonaSchema.parse(legacy).appearance, undefined);
  const excessive = {
    ...emptyPersonaDraft,
    displayName: "Alex",
    summary: legacy.summary,
    traits: Array.from({ length: 25 }, (_, index) => `Trait ${index}`).join("\n")
  };
  const payload = personaDraftPayload(excessive);
  assert.equal(payload.traits.length, 25);
  assert.equal(userPersonaSchema.safeParse(payload).success, false);
  assert.equal(userPersonaSchema.safeParse({ ...legacy, appearance: "a".repeat(8001) }).success, false);
});

test("the editor has one mode and switching profiles keeps already hydrated list fields", async () => {
  const source = await readFile(
    new URL("../src/components/settings/user-persona-settings-client.tsx", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /FormMode|isSimpleMode|Advanced editor|label="Advanced"|setFreeform/);
  assert.match(source, /id="persona-appearance-title"/);
  assert.match(source, /id="persona-personality-title"/);
  assert.match(source, /id="persona-traits-title"/);
  const switchProfile = source.slice(
    source.indexOf("function switchProfile"),
    source.indexOf("async function changeDefaultPersona")
  );
  assert.doesNotMatch(switchProfile, /personaProfileFromApi/);
  assert.match(switchProfile, /setRevisions\(\[\]\)/);
});

test("saving and restoring versions preserves appearance and older clients cannot erase it", async () => {
  let saved = { ...legacy, userId: "owner", appearance: "Silver hair." as string | null };
  const revisions: Array<{ id: string; version: number; snapshot: Record<string, unknown> }> = [];
  const tx = {
    userPersona: {
      findMany: async () => [saved],
      findFirst: async ({ where }: { where: { userId: string } }) => (where.userId === saved.userId ? saved : null),
      update: async ({ data: changes }: { data: Partial<typeof saved> }) => {
        saved = { ...saved, ...changes };
        return saved;
      }
    },
    userPersonaRevision: {
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id ? revisions.find((revision) => revision.id === where.id) : revisions.at(-1),
      create: async ({ data: revision }: { data: { version: number; snapshot: Record<string, unknown> } }) => {
        const entry = { ...revision, id: `revision-${revisions.length + 1}` };
        revisions.push(entry);
        return entry;
      }
    }
  };
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@prisma/client": {},
    "@/lib/prisma": { prisma: { $transaction: (action: (transaction: typeof tx) => unknown) => action(tx) } },
    "@/lib/user-persona-profiles": { normalizePersonaRows },
    "@/lib/api": {
      HttpError: class extends Error {
        constructor(_status: number, message: string) {
          super(message);
        }
      }
    }
  };
  const exports = {};
  const source = await readFile(new URL("../src/lib/user-persona-store.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports,
    require: (name: string) => {
      assert.ok(name in modules, name);
      return modules[name];
    }
  });
  const store = exports as {
    saveUserPersona(user: string, input: object): Promise<unknown>;
    restorePersonaRevision(user: string, persona: string, revision: string): Promise<unknown>;
  };
  await store.saveUserPersona("owner", { ...legacy, profileId: legacy.id, appearance: "Dark curls." });
  assert.equal(saved.appearance, "Dark curls.");
  assert.equal(revisions[0].snapshot.appearance, "Silver hair.");
  await store.saveUserPersona("owner", { ...legacy, profileId: legacy.id });
  assert.equal(saved.appearance, "Dark curls.");
  await assert.rejects(store.restorePersonaRevision("other-user", legacy.id, revisions[0].id), /not found/);
  await store.restorePersonaRevision("owner", legacy.id, revisions[0].id);
  assert.equal(saved.appearance, "Silver hair.");
  assert.deepEqual(saved.boundaries, legacy.boundaries);
});
