import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const prismaCli = join(projectRoot, "node_modules", "prisma", "build", "index.js");
const nextCli = join(projectRoot, "node_modules", "next", "dist", "bin", "next");

function run(cli, args, { allowFailure } = {}) {
  const captureOutput = typeof allowFailure === "function";
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: projectRoot,
    env: process.env,
    encoding: captureOutput ? "utf8" : undefined,
    stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "inherit"
  });

  if (captureOutput) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (allowFailure?.(output)) {
      console.warn("Database is temporarily unavailable; continuing the build without applying migrations.");
      return false;
    }

    process.exit(result.status ?? 1);
  }

  return true;
}

function isTemporaryDatabaseFailure(output) {
  const isNeonDatabase = /\.neon\.tech(?=[:/?\"']|$)/i.test(`${process.env.DATABASE_URL ?? ""}\n${output}`);

  return (
    /P1001|can't reach database server|exceeded the data transfer quota/i.test(output) ||
    (isNeonDatabase && /Schema engine error/i.test(output))
  );
}

if (process.env.VERCEL_ENV === "production" && process.env.SKIP_PRISMA_MIGRATE !== "1") {
  run(prismaCli, ["migrate", "deploy"], { allowFailure: isTemporaryDatabaseFailure });
}

run(prismaCli, ["generate"]);
run(nextCli, ["build"]);
