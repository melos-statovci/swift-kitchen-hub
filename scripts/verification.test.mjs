import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtempSync,
  readFileSync,
  existsSync,
  rmSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { spawnSync } from "node:child_process";

// Catch noisy-success output, lost failure details/status, unsafe quick plans,
// overlapping destructive runs and orchestration that resets occupied services.
const runner = path.resolve("scripts/verify.mjs");
const loadRunner = () => import("./verify.mjs");

test("quick CLI plans never run build, browser or database commands", () => {
  const result = spawnSync(process.execPath, [runner, "quick", "--plan"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const commands = JSON.parse(result.stdout)
    .flat()
    .map((check) => check.args.join(" "));
  assert(commands.some((command) => command === "run test"));
  assert(commands.some((command) => command === "run typecheck"));
  assert(!commands.some((command) => /build|integration|browser|prisma|reset/.test(command)));
});

test("workspace full runs integration before browser and builds backend only once", async () => {
  const { createPlan } = await loadRunner();
  const temporary = mkdtempSync(path.join(tmpdir(), "sk-verify-plan-"));
  const roots = Object.fromEntries(
    ["backend", "hub", "storefront"].map((role) => {
      const root = path.join(temporary, role);
      mkdirSync(root);
      writeFileSync(
        path.join(root, "package.json"),
        JSON.stringify({ scripts: { "format:check": "format-check" } }),
      );
      return [role, root];
    }),
  );
  try {
    const checks = createPlan(roots, "full", Object.keys(roots)).flat();
    const integration = checks.findIndex((check) => check.args.includes("test:integration"));
    const browser = checks.findIndex((check) => check.args.includes("test:browser"));
    assert(integration > 0 && browser > integration);
    assert.equal(
      checks.filter((check) => check.cwd === roots.backend && check.args.includes("build")).length,
      0,
    );
    for (const root of Object.values(roots)) {
      assert(checks.some((check) => check.cwd === root && check.args.includes("test")));
      assert(checks.some((check) => check.cwd === root && check.args.includes("typecheck")));
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("successful commands keep detailed output in logs and print only summary/count", async () => {
  const { runCheck } = await loadRunner();
  const logDir = mkdtempSync(path.join(tmpdir(), "sk-verify-success-"));
  const lines = [];
  try {
    const result = await runCheck(
      {
        label: "Unit",
        cwd: logDir,
        command: process.execPath,
        args: ["-e", "console.log('private-success-detail'); console.log('Tests 7 passed (7)')"],
      },
      { logDir, emit: (line) => lines.push(line) },
    );
    assert.equal(result.code, 0);
    assert.match(lines.join("\n"), /Unit.*PASS.*7/);
    assert(!lines.join("\n").includes("private-success-detail"));
    assert.match(readFileSync(result.log, "utf8"), /private-success-detail/);
  } finally {
    rmSync(logDir, { recursive: true, force: true });
  }
});

test("failure preserves stderr, reports log path and returns the command's nonzero status", async () => {
  const { runCheck } = await loadRunner();
  const logDir = mkdtempSync(path.join(tmpdir(), "sk-verify-fail-"));
  const lines = [];
  try {
    const result = await runCheck(
      {
        label: "Broken",
        cwd: logDir,
        command: process.execPath,
        args: ["-e", "console.error('useful failure'); process.exit(7)"],
      },
      { logDir, emit: (line) => lines.push(line) },
    );
    assert.equal(result.code, 7);
    assert.match(lines.join("\n"), /Broken.*FAIL/);
    assert(lines.join("\n").includes(result.log));
    assert.match(readFileSync(result.log, "utf8"), /useful failure/);
  } finally {
    rmSync(logDir, { recursive: true, force: true });
  }
});

test("missing command is a failed check with a usable diagnostic log", async () => {
  const { runCheck } = await loadRunner();
  const logDir = mkdtempSync(path.join(tmpdir(), "sk-verify-missing-"));
  try {
    const result = await runCheck(
      { label: "Missing", cwd: logDir, command: path.join(logDir, "not-a-command"), args: [] },
      { logDir, emit: () => {} },
    );
    assert.notEqual(result.code, 0);
    assert.match(readFileSync(result.log, "utf8"), /ENOENT/);
  } finally {
    rmSync(logDir, { recursive: true, force: true });
  }
});

test("heavy lock refuses concurrent runs and releases after owner cleanup", async () => {
  const { acquireHeavyLock } = await loadRunner();
  const root = mkdtempSync(path.join(tmpdir(), "sk-verify-lock-"));
  try {
    const release = acquireHeavyLock(root);
    assert.throws(() => acquireHeavyLock(root), /verification.*running|lock/i);
    release();
    assert(!existsSync(path.join(root, ".verification", "heavy.lock")));
    acquireHeavyLock(root)();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("heavy preflight refuses a listening local service instead of reusing or killing it", async () => {
  const { assertPortsFree } = await loadRunner();
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  try {
    await assert.rejects(assertPortsFree([port]), /Stop.*service|occupied|listening/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  await assertPortsFree([port]);
});

test("unknown mode exits nonzero without starting checks", () => {
  const result = spawnSync(process.execPath, [runner, "typo"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown.*mode|Usage/);
});

test("CLI propagates failed checks and does not report all checks passed", () => {
  const root = mkdtempSync(path.join(tmpdir(), "sk-verify-cli-"));
  try {
    mkdirSync(path.join(root, "scripts"));
    copyFileSync(runner, path.join(root, "scripts/verify.mjs"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "swift-kitchen-backend",
        scripts: { test: "node -e \"console.error('deliberate failure'); process.exit(7)\"" },
      }),
    );
    const result = spawnSync(process.execPath, [path.join(root, "scripts/verify.mjs"), "quick"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /backend unit.*FAIL/);
    assert.match(result.stdout, /deliberate failure/);
    assert.match(result.stdout, /Log: .*backend-unit\.log/);
    assert(!result.stdout.includes("ALL CHECKS PASSED"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CI skips heavy proof only for known documentation changes", async () => {
  const { requiresHeavyProof } = await import("./verification-changes.mjs");
  assert.equal(requiresHeavyProof(["docs/guide.md", "README.md"]), false);
  for (const files of [
    [],
    ["docs/guide.md", "src/routes/orders.ts"],
    ["package-lock.json"],
    [".github/workflows/verification.yml"],
    ["shared/contracts/menu.json"],
    ["unknown/new-file"],
  ]) {
    assert.equal(requiresHeavyProof(files), true, files.join(","));
  }
});

test("cancelled verification cannot start a subsequent command", async () => {
  const { runCheck } = await loadRunner();
  const root = mkdtempSync(path.join(tmpdir(), "sk-verify-cancel-"));
  const controller = new AbortController();
  controller.abort();
  try {
    const marker = path.join(root, "must-not-run");
    const result = await runCheck(
      {
        label: "Cancelled",
        cwd: root,
        command: process.execPath,
        args: ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'unsafe')`],
      },
      { logDir: root, emit: () => {}, signal: controller.signal },
    );
    assert.equal(result.code, 130);
    assert(!existsSync(marker));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a child exiting zero after cancellation cannot turn cancellation into PASS", async () => {
  const { runCheck } = await loadRunner();
  const root = mkdtempSync(path.join(tmpdir(), "sk-verify-term-"));
  const controller = new AbortController();
  try {
    const ready = path.join(root, "ready");
    const running = runCheck(
      {
        label: "Term",
        cwd: root,
        command: process.execPath,
        args: [
          "-e",
          `process.on('SIGTERM',()=>process.exit(0)); require('node:fs').writeFileSync(${JSON.stringify(ready)}, 'ready'); setTimeout(()=>process.exit(0),500);`,
        ],
      },
      { logDir: root, emit: () => {}, signal: controller.signal },
    );
    for (let n = 0; n < 100 && !existsSync(ready); n++) await delay(10);
    assert(existsSync(ready));
    controller.abort();
    const result = await running;
    assert.equal(result.code, 130);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("timeout force-stops a TERM-ignoring command and reports timeout", async () => {
  const { runCheck } = await loadRunner();
  const root = mkdtempSync(path.join(tmpdir(), "sk-verify-timeout-"));
  try {
    const result = await runCheck(
      {
        label: "Timeout",
        cwd: root,
        command: process.execPath,
        args: ["-e", "process.on('SIGTERM',()=>{}); setTimeout(()=>process.exit(0),1100)"],
      },
      { logDir: root, emit: () => {}, timeoutMs: 300, killGraceMs: 100 },
    );
    assert.equal(result.code, 124);
    assert.equal(result.signal, "SIGKILL");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing or stray component arguments fail instead of selecting the current repository", () => {
  for (const args of [
    ["full", "--plan", "--component"],
    ["full", "--plan", "storefront"],
  ]) {
    const result = spawnSync(process.execPath, [runner, ...args], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage|component/i);
  }
});
