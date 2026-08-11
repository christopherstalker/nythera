import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertCanonicalAuthOrigin,
  CANONICAL_SITE_ORIGIN
} from "../src/lib/site-origin";

test("production auth rejects missing or non-canonical origins", () => {
  assert.equal(CANONICAL_SITE_ORIGIN, "https://www.nythera.art");
  assert.doesNotThrow(() =>
    assertCanonicalAuthOrigin(
      "production",
      "https://www.nythera.art",
      "https://www.nythera.art"
    )
  );
  assert.throws(
    () =>
      assertCanonicalAuthOrigin(
        "production",
        "https://nythera-ai-character-platform.vercel.app",
        "https://www.nythera.art"
      ),
    /canonical production origin/
  );
  assert.throws(
    () => assertCanonicalAuthOrigin("production", undefined, "https://www.nythera.art"),
    /AUTH_URL must be set/
  );
});

test("the old deployment host is not a metadata or PWA fallback", async () => {
  const [layout, pwa] = await Promise.all([
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/pwa.ts", import.meta.url), "utf8")
  ]);

  assert.doesNotMatch(layout, /nythera-ai-character-platform\.vercel\.app/);
  assert.doesNotMatch(pwa, /nythera-ai-character-platform\.vercel\.app/);
  assert.match(layout, /resolveSiteOrigin\(\)/);
  assert.match(pwa, /CANONICAL_SITE_ORIGIN/);
});
