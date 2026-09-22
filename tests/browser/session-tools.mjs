import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = "output/session-tools";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
page.setDefaultTimeout(30000);
const origin = "http://127.0.0.1:3100";
const capture = async (name) => {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: false });
};
const noOverflow = async () =>
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

try {
  await page.goto(`${origin}/studio`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByRole("button", { name: "Test scene", exact: true }).first().click();
  await page.getByRole("button", { name: "Remember a detail", exact: true }).click();
  await page.getByRole("button", { name: "Run test scene", exact: true }).click();
  await page.getByText("Latest reply", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Keep as baseline", exact: true }).click();
  await page.getByRole("button", { name: "Run again", exact: true }).click();
  await page.getByText("The water can wait.", { exact: false }).waitFor();
  await page.getByLabel("Facts are respected", { exact: true }).check();
  await capture("studio-comparison-desktop");
  await noOverflow();
  await page.keyboard.press("Escape");
  await assert.doesNotReject(() =>
    page
      .getByRole("button", { name: "Test scene", exact: true })
      .first()
      .evaluate((button) => {
        if (button !== document.activeElement) throw new Error("Dialog focus did not return to its trigger");
      })
  );

  await page.goto(`${origin}/chat/fixture-chat-0`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByRole("button", { name: "Start here", exact: true }).click();
  await page.getByLabel("Provider API key", { exact: true }).fill("fixture-connection-value");
  await page.getByRole("button", { name: "Verify and connect", exact: true }).click();
  await page.getByLabel("Saved model connection", { exact: true }).waitFor();
  await page.getByText("Ask a question", { exact: true }).click();
  await capture("first-scene-desktop");
  await page.getByRole("button", { name: "Use opening", exact: true }).click();
  assert.equal(
    await page.locator("textarea").first().inputValue(),
    'I look toward you. "What should I know before we begin?"'
  );
  await page.getByRole("button", { name: "Reply context", exact: true }).click();
  await page.getByText("Elena is carrying the brass compass you gave her.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Show excluded · 1", exact: true }).click();
  await capture("reply-context-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await capture("reply-context-mobile");
  await page.keyboard.press("Escape");

  await page.addInitScript(() => {
    window.nytheraDesktop = {
      platform: "win32",
      version: "1.1.0",
      local: {
        models: async () => ({ ok: true, models: ["local-story-model", "local-writing-model"] }),
        generate: async () => ({ ok: false, error: "Generation is verified separately in transport tests." }),
        cancel: async () => {},
        onDelta: () => () => {}
      }
    };
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Local model", exact: true }).click();
  await page.getByRole("button", { name: "Find models", exact: true }).click();
  await page.getByRole("button", { name: "Use this model", exact: true }).click();
  await page.getByText("Selected for chats and test scenes on this computer.", { exact: true }).waitFor();
  await capture("local-model-mobile");
  await noOverflow();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Local · local-story-model", exact: true }).waitFor();
  await page.getByRole("button", { name: "Local · local-story-model", exact: true }).click();
  await page.getByRole("button", { name: "Use cloud", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Local model", exact: true }).waitFor();

  await page.goto(`${origin}/studio`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Test scene", exact: true }).first().click();
  await page.route("**/api/characters/*/test-scene", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "The model is temporarily unavailable. Try again." })
    })
  );
  await page.getByRole("button", { name: "Run test scene", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "temporarily unavailable" }).waitFor();
  assert.equal(
    await page.getByLabel("Scene to test", { exact: true }).inputValue(),
    "We meet at the entrance just before closing time. I ask what brought you here."
  );
  await capture("studio-error-mobile");
  await noOverflow();
  assert.deepEqual(failures, []);
  await writeFile(
    `${output}/browser-verification.json`,
    JSON.stringify(
      {
        passed: true,
        widths: [1440, 390],
        checks: [
          "Studio generation and baseline comparison",
          "Dialog Escape and focus restoration",
          "First connection and editable opening",
          "Saved context and excluded records",
          "Local discovery, selection and cloud switch",
          "Failure preserves scene draft",
          "No horizontal overflow",
          "No uncaught browser errors"
        ],
        fixtures: true
      },
      null,
      2
    )
  );
  console.log("Session tools browser checks passed.");
} finally {
  await browser.close();
}
