import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("the PWA worker purges legacy caches and never owns versioned Next assets", async () => {
  const worker = await read("../public/sw.js");

  assert.match(worker, /CACHE_PREFIX = "nythera-codex-"/);
  assert.match(worker, /CACHE_NAME = "nythera-codex-v6"/);
  assert.match(worker, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE_NAME/);
  assert.match(worker, /if\s*\(\s*url\.pathname\.startsWith\("\/_next\/static\/"\)\s*\)\s*\{\s*return;/);
  assert.match(worker, /url\.pathname\.startsWith\("\/icons\/"\)[\s\S]*?fetch\(request\)[\s\S]*?caches\.match\(request\)/);
  const installHandler = worker.slice(worker.indexOf('self.addEventListener("install"'), worker.indexOf('self.addEventListener("activate"'));
  assert.doesNotMatch(installHandler, /skipWaiting/);
});

test("the installed app checks for updates and reloads only after controller takeover", async () => {
  const provider = await read("../src/components/providers/pwa-provider.tsx");

  assert.match(provider, /updateViaCache: "none"/);
  assert.match(provider, /registration\?\.update\(\)/);
  assert.match(provider, /addEventListener\("visibilitychange", checkForUpdate\)/);
  assert.match(provider, /addEventListener\("pageshow", checkForUpdate\)/);
  assert.match(provider, /onControllerChange[\s\S]*?window\.location\.reload\(\)/);

  const applyUpdate = provider.slice(provider.indexOf("const applyUpdate"), provider.indexOf("const hasNativeInstallPrompt"));
  assert.match(applyUpdate, /SKIP_WAITING/);
  assert.doesNotMatch(applyUpdate, /window\.location\.reload/);
});

test("legacy installed PWA traffic moves through canonical migration", async () => {
  const config = await read("../next.config.mjs");

  assert.match(config, /type: "host"/);
  assert.match(config, /value: "nythera-ai-character-platform\.vercel\.app"/);
  assert.match(config, /https:\/\/www\.nythera\.art\/pwa-migrate\?source=legacy-pwa&next=\/:path\*/);
  assert.match(config, /permanent: false/);
});
