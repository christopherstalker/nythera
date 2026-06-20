import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const prismaCli = join(projectRoot, "node_modules", "prisma", "build", "index.js");
const nextCli = join(projectRoot, "node_modules", "next", "dist", "bin", "next");

function run(cli, args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.VERCEL_ENV === "production") {
  run(prismaCli, ["migrate", "deploy"]);
}

run(prismaCli, ["generate"]);
run(nextCli, ["build"]);
