import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertCanonicalAuthOrigin,
  CANONICAL_SITE_ORIGIN,
  FALLBACK_SITE_ORIGIN,
  productionDeploymentRedirectUrl
} from "../src/lib/site-origin";

test("production auth accepts canonical and fallback origins", () => {
  assert.equal(CANONICAL_SITE_ORIGIN, "https://www.nythera.art");
  assert.equal(FALLBACK_SITE_ORIGIN, "https://nythera-ai-character-platform.vercel.app");
  assert.doesNotThrow(() =>
    assertCanonicalAuthOrigin(
      "production",
      "https://www.nythera.art",
      "https://www.nythera.art"
    )
  );
  assert.doesNotThrow(() =>
    assertCanonicalAuthOrigin(
      "production",
      FALLBACK_SITE_ORIGIN,
      FALLBACK_SITE_ORIGIN
    )
  );
  assert.throws(
    () => assertCanonicalAuthOrigin("production", "https://example.com", "https://example.com"),
    /approved production origin/
  );
  assert.throws(
    () => assertCanonicalAuthOrigin("production", FALLBACK_SITE_ORIGIN, CANONICAL_SITE_ORIGIN),
    /must use the same production origin/
  );
  assert.throws(
    () => assertCanonicalAuthOrigin("production", undefined, "https://www.nythera.art"),
    /AUTH_URL must be set/
  );
});

test("production Vercel deployment URLs redirect to the active auth origin", () => {
  assert.equal(
    productionDeploymentRedirectUrl(
      "https://nythera-5z0k9767o-christopherstalkers-projects.vercel.app/login?callbackUrl=%2Fexplore",
      "nythera-5z0k9767o-christopherstalkers-projects.vercel.app",
      "production",
      FALLBACK_SITE_ORIGIN
    )?.toString(),
    `${FALLBACK_SITE_ORIGIN}/login?callbackUrl=%2Fexplore`
  );
  assert.equal(
    productionDeploymentRedirectUrl(
      `${FALLBACK_SITE_ORIGIN}/login`,
      "nythera-ai-character-platform.vercel.app",
      "production",
      FALLBACK_SITE_ORIGIN
    ),
    null
  );
  assert.equal(
    productionDeploymentRedirectUrl(
      "https://nythera-gvcl64jw6-christopherstalkers-projects.vercel.app/chat/123",
      "nythera-gvcl64jw6-christopherstalkers-projects.vercel.app",
      "production",
      CANONICAL_SITE_ORIGIN
    )?.toString(),
    `${CANONICAL_SITE_ORIGIN}/chat/123`
  );
  assert.equal(
    productionDeploymentRedirectUrl(
      `${FALLBACK_SITE_ORIGIN}/chat/123`,
      "nythera-ai-character-platform.vercel.app",
      "production",
      CANONICAL_SITE_ORIGIN
    ),
    null
  );
  assert.equal(
    productionDeploymentRedirectUrl(
      "https://www.nythera.art/login",
      "www.nythera.art",
      "production",
      CANONICAL_SITE_ORIGIN
    ),
    null
  );
  assert.equal(
    productionDeploymentRedirectUrl(
      "http://localhost:3000/login",
      "localhost:3000",
      undefined,
      CANONICAL_SITE_ORIGIN
    ),
    null
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
