import { spawn } from "node:child_process";
import { connect } from "node:net";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const roles = ["backend", "hub", "storefront"];
const modes = ["quick", "full", "ci", "integration", "browser", "preflight"];
const localUrls = {
  DATABASE_URL: "postgresql://test:test@127.0.0.1:55441/swiftkitchen_shared_dua_test",
  DIRECT_URL: "postgresql://test:test@127.0.0.1:55441/swiftkitchen_shared_dua_test",
};
const cancellation = new AbortController();
const npmCheck = (roots, role, script, label = script) => ({
  label: `${role} ${label}`,
  cwd: roots[role],
  command: "npm",
  args: ["run", script],
});
const formatCheck = (roots, role) => {
  const check = npmCheck(roots, role, "format:check", "format");
  if (!JSON.parse(readFileSync(path.join(roots[role], "package.json"))).scripts["format:check"]) {
    check.command = "npx";
    check.args = [
      "--no-install",
      "prettier",
      "--check",
      "src/**/*.{ts,tsx,mjs,css}",
      "tests/**/*.ts",
      "*.json",
      "*.ts",
      "*.js",
    ];
  }
  return check;
};
const prismaCheck = (roots) => ({
  label: "backend Prisma",
  cwd: roots.backend,
  command: "npx",
  args: ["--no-install", "prisma", "validate"],
  env: localUrls,
});
const guardCheck = (roots) => ({
  label: "Disposable database guards",
  cwd: roots.backend,
  command: process.execPath,
  args: [
    path.join(roots.backend, "node_modules/tsx/dist/cli.mjs"),
    "-e",
    `
    const {readFileSync}=require('node:fs');
    const {parse}=require('dotenv');
    const {assertDisposableDatabaseEnvironment}=require('./src/lib/localDatabaseGuard.ts');
    for (const [kind,port] of [['dua','31041'],['flat','31042']]) {
      const env={...process.env,...parse(readFileSync('.env.shared-'+kind+'.example'))};
      assertDisposableDatabaseEnvironment(env);
      if (env.PORT!==port) throw Error('Refusing unexpected proof API port');
    }
    console.log('Both exact disposable local targets accepted');
  `,
  ],
});

export function createPlan(roots, mode, selected) {
  if (!modes.includes(mode)) throw Error(`Unknown verification mode: ${mode}`);
  const stages = [];
  const add = (checks) => {
    if (checks.length) stages.push(checks);
  };
  if (
    ["full", "integration", "browser", "preflight"].includes(mode) &&
    (selected.includes("backend") || selected.includes("storefront") || mode !== "full")
  ) {
    add([guardCheck(roots)]);
  }
  if (["quick", "full", "ci"].includes(mode)) {
    for (const script of ["test", "typecheck", "lint"]) {
      add(
        selected
          .filter((role) => !(role === "backend" && script === "lint"))
          .map((role) =>
            npmCheck(
              roots,
              role,
              script,
              script === "test"
                ? "unit"
                : script === "typecheck" && role === "backend"
                  ? "types / lint"
                  : script,
            ),
          ),
      );
    }
    add(selected.map((role) => formatCheck(roots, role)));
    add(
      selected
        .filter((role) => existsSync(path.join(roots[role], "scripts/verification.test.mjs")))
        .map((role) => ({
          label: `${role} runner tests`,
          cwd: roots[role],
          command: process.execPath,
          args: [
            "--test",
            ...readdirSync(path.join(roots[role], "scripts"))
              .filter((name) => /^verification.*\.test\.mjs$/.test(name))
              .map((name) => `scripts/${name}`),
          ],
        })),
    );
    add(
      selected.map((role) => ({
        label: `${role} diff`,
        cwd: roots[role],
        command: "git",
        args: ["diff", "--check", "HEAD"],
      })),
    );
  }
  if (["full", "ci"].includes(mode)) {
    // test:integration already builds backend; do not build it twice in full.
    add(
      selected
        .filter((role) => !(role === "backend" && mode === "full"))
        .map((role) => npmCheck(roots, role, "build")),
    );
    if (selected.includes("backend")) add([prismaCheck(roots)]);
  }
  if (mode === "integration" || (mode === "full" && selected.includes("backend"))) {
    add([npmCheck(roots, "backend", "test:integration", "PostgreSQL integration + build")]);
  }
  if (mode === "browser" || (mode === "full" && selected.includes("storefront"))) {
    if (!selected.includes("backend") || mode === "browser")
      add([npmCheck(roots, "backend", "build", "browser prerequisite build")]);
    add([npmCheck(roots, "storefront", "typecheck:browser", "browser types")]);
    add([npmCheck(roots, "storefront", "test:browser", "browser")]);
  }
  return stages;
}

export async function assertPortsFree(ports = [31041, 31042, 4173, 4174, 8083, 8084]) {
  await Promise.all(
    ports.map(
      (port) =>
        new Promise((resolve, reject) => {
          const socket = connect({ host: "127.0.0.1", port });
          socket.setTimeout(1000);
          socket.once("connect", () => {
            socket.destroy();
            reject(
              Error(
                `Port ${port} is occupied. Stop owner/proof services with their controller before heavy verification.`,
              ),
            );
          });
          socket.once("error", (error) => {
            socket.destroy();
            if (error.code === "ECONNREFUSED") resolve();
            else reject(error);
          });
          socket.once("timeout", () => {
            socket.destroy();
            reject(Error(`Unable to establish whether local port ${port} is free`));
          });
        }),
    ),
  );
}

export function acquireHeavyLock(root) {
  const directory = path.join(root, ".verification");
  const lock = path.join(directory, "heavy.lock");
  mkdirSync(directory, { recursive: true });
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    throw Error(
      `Heavy verification lock exists: ${lock}. Another verification may be running. Inspect owner.json; remove a stale lock only after confirming its process stopped.`,
    );
  }
  writeFileSync(
    path.join(lock, "owner.json"),
    JSON.stringify({ pid: process.pid, started: new Date().toISOString() }),
  );
  return () => rmSync(lock, { recursive: true, force: true });
}

function stopChild(child, signal = "SIGTERM") {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

export async function runCheck(
  check,
  { logDir, emit = console.log, signal, timeoutMs = 20 * 60 * 1000, killGraceMs = 5000 },
) {
  mkdirSync(logDir, { recursive: true });
  const log = path.join(logDir, check.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".log");
  const fd = openSync(log, "w");
  let errorText = signal?.aborted ? "Verification interrupted before launching check\n" : "";
  let timedOut = false;
  let exitSignal = null;
  const interruptedCode = () => (signal?.reason === "SIGTERM" ? 143 : 130);
  const code = signal?.aborted
    ? interruptedCode()
    : await new Promise((resolve) => {
        const child = spawn(check.command, check.args, {
          cwd: check.cwd,
          env: { ...process.env, ...check.env },
          stdio: ["ignore", fd, fd],
          detached: true,
        });
        let killTimer;
        const terminate = () => {
          stopChild(child);
          killTimer ??= setTimeout(() => stopChild(child, "SIGKILL"), killGraceMs);
        };
        signal?.addEventListener("abort", terminate, { once: true });
        const timer = setTimeout(() => {
          timedOut = true;
          terminate();
        }, timeoutMs);
        child.once("error", (error) => {
          errorText = error.stack ?? String(error);
        });
        child.once("close", (status, childSignal) => {
          exitSignal = childSignal;
          clearTimeout(timer);
          clearTimeout(killTimer);
          signal?.removeEventListener("abort", terminate);
          resolve(timedOut ? 124 : signal?.aborted ? interruptedCode() : (status ?? 1));
        });
      });
  closeSync(fd);
  if (errorText) writeFileSync(log, errorText, { flag: "a" });
  if (timedOut) writeFileSync(log, `\nCheck timed out after ${timeoutMs}ms\n`, { flag: "a" });
  const output = readFileSync(log, "utf8").replace(/\x1b\[[0-9;]*m/g, "");
  const count = output.match(
    /Tests\s+(\d+) passed|[ℹ#]\s*(?:tests|pass)\s+(\d+)|(?:^|\n)\s*(\d+) passed \(/,
  );
  const total = count && (count[1] ?? count[2] ?? count[3]);
  emit(
    `${check.label.padEnd(38, ".")} ${code === 0 ? "PASS" : "FAIL"}${total ? ` (${total})` : ""}`,
  );
  if (code !== 0) {
    emit(`Log: ${log}`);
    emit(output.split("\n").slice(-15).join("\n"));
  }
  return { label: check.label, code, log, signal: exitSignal };
}

function resolveRoots(root, role) {
  return Object.fromEntries(
    roles.map((candidate) => [
      candidate,
      candidate === role ? root : path.resolve(root, "..", `resilient-published-menu-${candidate}`),
    ]),
  );
}

async function main() {
  const [mode = "quick", ...args] = process.argv.slice(2);
  let validArgs = modes.includes(mode) && args.filter((arg) => arg === "--component").length <= 1;
  for (let index = 0; index < args.length; index++) {
    if (["--workspace", "--plan"].includes(args[index])) continue;
    if (args[index] === "--component" && roles.includes(args[index + 1])) index++;
    else validArgs = false;
  }
  if (!validArgs)
    throw Error(
      "Usage: node scripts/verify.mjs quick|full|ci|integration|browser|preflight [--workspace] [--component backend|hub|storefront] [--plan]",
    );
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const name = JSON.parse(readFileSync(path.join(root, "package.json"))).name;
  const role =
    name === "swift-kitchen-backend"
      ? "backend"
      : name === "swift-kitchen-hub"
        ? "hub"
        : "storefront";
  const roots = resolveRoots(root, role);
  const component = args.includes("--component") ? args[args.indexOf("--component") + 1] : null;
  if (component && !roles.includes(component)) throw Error("Unknown component");
  const selected = component ? [component] : args.includes("--workspace") ? roles : [role];
  const plan = createPlan(roots, mode, selected);
  if (args.includes("--plan")) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  const logDir = path.join(
    root,
    ".verification",
    "logs",
    new Date().toISOString().replace(/[:.]/g, "-") + `-${process.pid}`,
  );
  mkdirSync(logDir, { recursive: true });
  console.log(`SwiftKitchen verification (${mode})\nLogs: ${logDir}\n`);
  const heavy =
    ["integration", "browser", "preflight"].includes(mode) ||
    (mode === "full" && (selected.includes("backend") || selected.includes("storefront")));
  const results = [];
  let release;
  try {
    if (heavy) release = acquireHeavyLock(roots.backend);
    for (const [index, stage] of plan.entries()) {
      if (cancellation.signal.aborted) break;
      const completed = await Promise.all(
        stage.map((check) => runCheck(check, { logDir, signal: cancellation.signal })),
      );
      results.push(...completed);
      if (completed.some((result) => result.code !== 0)) {
        process.exitCode ||= 1;
        break;
      }
      if (heavy && index === 0) await assertPortsFree();
    }
  } catch (error) {
    const log = path.join(logDir, "preflight.log");
    writeFileSync(log, error.stack ?? String(error));
    console.error(`Preflight FAILED: ${error.message}\nLog: ${log}`);
    results.push({ label: "preflight", code: 1, log });
    process.exitCode ||= 1;
  } finally {
    release?.();
    writeFileSync(path.join(logDir, "results.json"), JSON.stringify(results, null, 2));
  }
  console.log(process.exitCode ? "\nVERIFICATION FAILED" : "\nALL CHECKS PASSED");
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      process.exitCode = signal === "SIGINT" ? 130 : 143;
      cancellation.abort(signal);
    });
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
