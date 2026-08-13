import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildProviderModelGroups,
  inferProviderModelValue,
  providerModelValue
} from "../src/lib/provider-model-options";

const savedProviders = [
  {
    provider: "openai",
    displayName: "OpenAI",
    defaultModel: "gpt-4o-mini",
    last4: "1234",
    isDefault: true
  },
  {
    provider: "my-ollama",
    displayName: "My Ollama",
    defaultModel: "llama3.1",
    last4: "test",
    isDefault: false
  }
];

test("builds grouped chat model picker options from saved provider keys", () => {
  const groups = buildProviderModelGroups(savedProviders);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].displayName, "OpenAI");
  assert.equal(groups[0].options[0].value, "openai:gpt-4o-mini");
  assert.equal(groups[1].displayName, "My Ollama");
  assert.deepEqual(groups[1].options.map((option) => option.value), ["my-ollama:llama3.1"]);
  assert.equal(providerModelValue("My-Ollama", " llama3.1 "), "my-ollama:llama3.1");
});

test("infers provider-qualified values for legacy saved chat models", () => {
  const groups = buildProviderModelGroups(savedProviders);

  assert.equal(inferProviderModelValue("gpt-4o-mini", groups), "openai:gpt-4o-mini");
  assert.equal(inferProviderModelValue("my-ollama:llama3.1", groups), "my-ollama:llama3.1");
  assert.equal(inferProviderModelValue("missing-model", groups), "");
  assert.equal(inferProviderModelValue("openai:gpt-future", groups), "openai:gpt-future");
});

test("live provider models lead the picker without losing bundled fallbacks", () => {
  const groups = buildProviderModelGroups(savedProviders, { openai: ["gpt-live-new"] });
  assert.equal(groups[0].options[0].value, "openai:gpt-4o-mini");
  assert.ok(groups[0].options.some((option) => option.value === "openai:gpt-live-new"));
  assert.ok(groups[0].options.some((option) => option.value === "openai:gpt-4o-mini"));
});

test("chat composer replaces provider:model free text with a grouped picker", async () => {
  const inputSource = await readFile(new URL("../src/components/chat/ChatInput.tsx", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../src/components/chat/chat-client.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(inputSource, /placeholder="provider:model"/);
  assert.match(inputSource, /<select[\s\S]*onModelChange/);
  assert.match(inputSource, /<optgroup/);
  assert.match(inputSource, /Search provider or model/);
  assert.match(inputSource, /Showing all.*available models/);
  assert.doesNotMatch(inputSource, /index < 6/);
  assert.match(inputSource, /Add a provider key in Settings/);
  assert.match(clientSource, /fetch\("\/api\/keys"/);
  assert.match(clientSource, /buildProviderModelGroups/);
  assert.match(clientSource, /\/api\/keys\/models/);
  assert.match(clientSource, /modelGroups=\{providerModelGroups\}/);
  assert.match(clientSource, /rejectedProviderIds/);
  assert.match(clientSource, /credentialStatus !== "INVALID"/);
});

test("automatic catalog refreshes use the cache while manual refresh remains explicit", async () => {
  const settingsSource = await readFile(new URL("../src/components/settings/key-settings-client.tsx", import.meta.url), "utf8");

  assert.match(settingsSource, /await refreshModels\(false\)/);
  assert.match(settingsSource, /onClick=\{\(\) => void refreshModels\(true\)\}/);
});

test("custom provider settings are presented as named endpoints", async () => {
  const source = await readFile(new URL("../src/components/settings/key-settings-client.tsx", import.meta.url), "utf8");

  assert.match(source, /Saved custom provider endpoints/);
  assert.match(source, /Add custom provider endpoint/);
  assert.match(source, /Unique provider ID/);
  assert.match(source, /setCustom\(blankCustomProvider\)/);
});
