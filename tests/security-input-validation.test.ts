import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { imageSourceSchema } from "../src/lib/validation";

test("image source validation rejects executable or spoofed image inputs", () => {
  const pngHeaderDataUrl = "data:image/png;base64,iVBORw0KGgo=";
  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from("<svg><script>alert(1)</script></svg>").toString("base64")}`;

  assert.equal(imageSourceSchema.safeParse(pngHeaderDataUrl).success, true);
  assert.equal(imageSourceSchema.safeParse("https://images.example/avatar.png").success, true);
  assert.equal(imageSourceSchema.safeParse(svgDataUrl).success, false);
  assert.equal(imageSourceSchema.safeParse("javascript:alert(1)").success, false);
  assert.equal(imageSourceSchema.safeParse("http://images.example/avatar.png").success, false);
});

test("Prisma raw SQL uses tagged parameterized APIs, not unsafe APIs", async () => {
  const vectorSource = await readFile(new URL("../src/lib/vector.ts", import.meta.url), "utf8");
  const seedSource = await readFile(new URL("../prisma/seed.ts", import.meta.url), "utf8");

  assert.doesNotMatch(vectorSource, /\$queryRawUnsafe|\$executeRawUnsafe/);
  assert.doesNotMatch(seedSource, /\$queryRawUnsafe|\$executeRawUnsafe/);
  assert.match(vectorSource, /\$queryRaw<RetrievedMemory\[]>`/);
  assert.match(vectorSource, /\$executeRaw`UPDATE "Memory"/);
});

test("chat rich text renderer does not inject raw HTML", async () => {
  const richTextSource = await readFile(new URL("../src/components/chat/rich-message-text.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(richTextSource, /dangerouslySetInnerHTML|innerHTML/);
  assert.match(richTextSource, /React text nodes keep this safe from HTML\/script injection/);
});
