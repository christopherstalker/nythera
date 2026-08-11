import assert from "node:assert/strict";
import test from "node:test";
import { loadServerData } from "../src/lib/server-data";

test("loadServerData returns the loaded value", async () => {
  const value = await loadServerData("test value", async () => "ready", 50);

  assert.equal(value, "ready");
});

test("loadServerData preserves loader failures", async () => {
  const failure = new Error("database unavailable");

  await assert.rejects(loadServerData("test failure", async () => Promise.reject(failure), 50), failure);
});

test("loadServerData rejects slow operations", async () => {
  await assert.rejects(
    loadServerData("slow query", () => new Promise(() => undefined), 5),
    /slow query timed out after 5ms/
  );
});
