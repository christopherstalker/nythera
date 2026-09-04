import "dotenv/config";

import { timingSafeEqual } from "crypto";
import express from "express";
import pino from "pino";
import { loadGuardianConfig } from "./config.js";
import { GuardianMonitor } from "./monitor.js";
import { GuardianNotifier } from "./notifier.js";
import { GuardianStore } from "./store.js";

const config = loadGuardianConfig();
const logger = pino({ level: config.LOG_LEVEL });
const store = new GuardianStore(config);
const notifier = new GuardianNotifier(config, logger);
const monitor = new GuardianMonitor(config, store, notifier, logger);
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.get("/health", async (_request, response) => {
  const snapshot = await monitor.snapshot();
  response.setHeader("cache-control", "no-store");
  response.json({ ok: true, service: "nythera-guardian", status: snapshot.status, distributedStore: store.distributed() });
});

app.use("/v1", (request, response, next) => {
  if (!hasValidBearerToken(request.headers.authorization, config.GUARDIAN_API_TOKEN)) {
    response.status(401).json({ error: "Guardian API token required." });
    return;
  }
  next();
});

app.get("/v1/status", async (_request, response) => {
  response.setHeader("cache-control", "no-store");
  response.json({ ...(await monitor.snapshot()), distributedStore: store.distributed() });
});

app.post("/v1/check", async (_request, response) => {
  response.setHeader("cache-control", "no-store");
  response.json(await monitor.check("manual"));
});

const server = app.listen(config.PORT, () => {
  logger.info({
    event: "guardian_started",
    port: config.PORT,
    target: new URL(config.GUARDIAN_TARGET_URL).origin,
    intervalMs: config.GUARDIAN_INTERVAL_MS,
    distributedStore: store.distributed()
  });
  monitor.start();
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    monitor.stop();
    server.close(() => process.exit(0));
  });
}

function hasValidBearerToken(header: string | undefined, expected: string) {
  const token = header?.replace(/^Bearer\s+/i, "") ?? "";
  const actualBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
