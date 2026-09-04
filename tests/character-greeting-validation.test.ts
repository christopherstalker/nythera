import assert from "node:assert/strict";
import test from "node:test";

import { characterCreateSchema, characterUpdateSchema } from "../src/lib/validation";

const longGreeting = "A".repeat(25_000);

test("character greetings have no field-level length limit", () => {
  const created = characterCreateSchema.safeParse({
    creationMode: "custom",
    name: "Ari",
    description: "A patient archivist with a precise memory.",
    personality: "A patient archivist who protects continuity and canonical facts.",
    greeting: longGreeting,
    visibility: "PRIVATE",
    tags: [],
    isNSFW: false
  });
  const updated = characterUpdateSchema.safeParse({ greeting: longGreeting });

  assert.equal(created.success, true);
  assert.equal(updated.success, true);
});
