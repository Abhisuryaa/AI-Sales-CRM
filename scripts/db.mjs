#!/usr/bin/env node
// Portable Postgres + Redis lifecycle manager (no Docker, no admin rights).
//   node scripts/db.mjs up | down | status | reset
import { spawnSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const svc = join(root, "services");
const pgBin = join(svc, "pg", "bin");
const pgData = join(svc, "data", "pg");
const pgLog = join(svc, "data", "pg.log");
const redisBin = join(svc, "redis");
const redisLog = join(svc, "data", "redis.log");

// Service subprocesses die with STATUS_DLL_INIT_FAILED (0xC0000142) when the
// parent environment block is polluted (huge PATH, odd vars). Launch clean.
const CLEAN_ENV = {
  SystemRoot: process.env.SystemRoot || "C:\\Windows",
  SYSTEMROOT: process.env.SystemRoot || "C:\\Windows",
  TEMP: process.env.TEMP || "C:\\Windows\\Temp",
  TMP: process.env.TMP || "C:\\Windows\\Temp",
  PATH: "C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\Wbem",
};

const PG_PORT = 5433;
const REDIS_PORT = 6380;

function run(bin, args, opts = {}) {
  const r = spawnSync(bin, args, { stdio: "pipe", encoding: "utf8", env: CLEAN_ENV, ...opts });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

function ready() {
  const r = run(join(pgBin, "pg_isready.exe"), ["-h", "127.0.0.1", "-p", String(PG_PORT)]);
  return r.code === 0;
}

function redisPong() {
  const p = run(join(redisBin, "redis-cli.exe"), ["-p", String(REDIS_PORT), "ping"]);
  return p.code === 0 && p.out.includes("PONG");
}

function up() {
  if (!existsSync(pgData)) {
    mkdirSync(pgData, { recursive: true });
    const pw = join(svc, "data", "pwfile.txt");
    writeFileSync(pw, "postgres");
    const init = run(join(pgBin, "initdb.exe"), ["-D", pgData, "-U", "postgres", "-A", "scram-sha-256", `--pwfile=${pw}`, "-E", "UTF8"]);
    if (init.code !== 0) { console.error(init.out); process.exit(1); }
    console.log("initialized pg data dir");
  }
  if (!ready()) {
    run(join(pgBin, "pg_ctl.exe"), ["-D", pgData, "-l", pgLog, "-o", `-p ${PG_PORT}`, "start"]);
    // wait up to 15s
    for (let i = 0; i < 15 && !ready(); i++) {
      spawnSync("timeout", ["/t", "1", "/nobreak"], { shell: true, stdio: "ignore" });
    }
    if (!ready()) { console.error("pg failed to start; see services/data/pg.log"); process.exit(1); }
  }
  console.log(`postgres ready on :${PG_PORT}`);

  if (!redisPong()) {
    if (!existsSync(join(redisBin, "redis-server.exe"))) {
      console.error("redis-server.exe not found in services/redis");
      process.exit(1);
    }
    const child = spawn(join(redisBin, "redis-server.exe"), [
      "--port", String(REDIS_PORT),
      "--dir", join(svc, "data"),
      "--logfile", redisLog,
      "--save", "",
      "--appendonly", "no",
    ], { env: CLEAN_ENV, detached: true, stdio: "ignore" });
    child.unref();
    for (let i = 0; i < 20 && !redisPong(); i++) {
      spawnSync("timeout", ["/t", "1", "/nobreak"], { shell: true, stdio: "ignore" });
    }
    if (!redisPong()) { console.error("redis failed to start; see services/data/redis.log"); process.exit(1); }
  }
  console.log(`redis ready on :${REDIS_PORT}`);
}

function down() {
  run(join(pgBin, "pg_ctl.exe"), ["-D", pgData, "stop", "-m", "fast"]);
  run(join(redisBin, "redis-cli.exe"), ["-p", String(REDIS_PORT), "shutdown", "nosave"]);
  console.log("stopped");
}

function status() {
  console.log("postgres:", ready() ? "up" : "down");
  console.log("redis:", redisPong() ? "up" : "down");
}

function reset() {
  down();
  if (existsSync(pgData)) spawnSync("cmd", ["/c", "rmdir", "/s", "/q", pgData]);
  console.log("pg data dir removed; run `up` to reinit");
}

const cmd = process.argv[2];
if (cmd === "up") up();
else if (cmd === "down") down();
else if (cmd === "status") status();
else if (cmd === "reset") reset();
else { console.error("usage: node scripts/db.mjs up|down|status|reset"); process.exit(2); }
