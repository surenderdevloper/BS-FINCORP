/**
 * Zero-config demo: starts an in-process MongoDB (mongodb-memory-server),
 * seeds it with sample data, then runs `next dev`.
 *
 * Usage:  npm run demo
 *
 * MONGODB_URI / AUTH_SECRET set in this process take precedence over .env
 * (Next.js never overrides already-set environment variables).
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = fileURLToPath(new URL("..", import.meta.url));
const bin = (name) => `${root}node_modules/.bin/${name}`;

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri("bs_fincorp");
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");

console.log(">> MongoDB (in-memory) listening on", process.env.MONGODB_URI);

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))
    );
  });
}

try {
  await run(bin("tsx"), ["scripts/seed.ts"], process.env);
  console.log("\n>> Seeded demo data. Starting Next.js…\n");
  const port = process.env.PORT ?? "3010";
  const next = spawn(bin("next"), ["dev", "-p", port], {
    env: process.env,
    stdio: "inherit",
  });

  const shutdown = () => {
    next.kill("SIGINT");
    setTimeout(() => {
      mongod.stop();
      process.exit(0);
    }, 400);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  next.on("exit", (code) => {
    mongod.stop().finally(() => process.exit(code ?? 0));
  });
} catch (err) {
  console.error(err);
  await mongod.stop();
  process.exit(1);
}