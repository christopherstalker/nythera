import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildAdultRoleplayPolicyLayer } from "../src/lib/adult-roleplay-policy";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("adult roleplay policy allows explicit content without weakening consent boundaries", () => {
  const policy = buildAdultRoleplayPolicyLayer({ isNSFW: true, tags: ["dominant", "slow-burn"] });

  assert.match(policy, /Consensual adult sexual content may be explicit/i);
  assert.match(policy, /Do not refuse, censor, sanitize, moralize, soften, or fade to black/i);
  assert.match(policy, /Never sexualize minors or depict sexual coercion/i);
  assert.match(policy, /Character tags: dominant, slow-burn/);
});

test("power dynamics use explicit character facts and never gender stereotypes", () => {
  const policy = buildAdultRoleplayPolicyLayer({ isNSFW: false, tags: [] });

  assert.match(policy, /Never infer dominant, submissive, switch/i);
  assert.match(policy, /gender, anatomy, body type, archetype, status, or cultural stereotype/i);
  assert.match(policy, /Only an explicit statement in the character profile, persona, creator instructions, tags, or lore/i);
  assert.match(policy, /do not assume the player leads or yields/i);
  assert.match(policy, /Preserve an explicitly defined dynamic consistently/i);
});

test("platform prompt orders adult policy above configurable character instructions", async () => {
  const assembly = await read("../src/lib/prompt-assembly.ts");

  assert.match(assembly, /safetyLayer,[\s\S]*adultRoleplayPolicyLayer,[\s\S]*customPromptLayer/);
  assert.match(assembly, /Character tags:/);
});

test("proxy moderation does not reject adult content merely for being explicit", async () => {
  const proxy = await read("../proxy-service/src/server.ts");
  const moderation = proxy.slice(proxy.indexOf("function moderateText"), proxy.indexOf("function rateLimit"));

  assert.doesNotMatch(moderation, /explicit sex\|porn/);
  assert.match(moderation, /minor sex\|underage sex\|child porn/);
  assert.match(moderation, /sexual assault/);
});

test("character generation does not invent power dynamics from stereotypes", async () => {
  const [generation, assist, dataset] = await Promise.all([
    read("../src/lib/character-prompt-generation.ts"),
    read("../src/lib/character-section-assist.ts"),
    read("../scripts/nythera-character-generator/prompts.ts")
  ]);

  assert.match(generation, /CHARACTER_DYNAMIC_GENERATION_RULE/);
  assert.match(assist, /CHARACTER_DYNAMIC_GENERATION_RULE/);
  assert.match(dataset, /Never infer or assign dominant, submissive, switch/);
});
