import test, { after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";

const cacheDir = await mkdtemp(join(tmpdir(), "swiftkitchen-archive-window-tests-"));
const server = await createServer({
  configFile: false,
  cacheDir,
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
  logLevel: "error",
});
after(async () => {
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
});
const { windowToFromDate } = await server.ssrLoadModule("/src/hooks/useArchive.ts");

test("Last 7 days is a rolling duration through the spring DST change", () => {
  const nowMs = Date.parse("2026-03-30T12:00:00Z");
  assert.equal(windowToFromDate("7d", nowMs)?.toISOString(), "2026-03-23T12:00:00.000Z");
});

test("All time includes records older than 2020 while supplying a cutoff to the API", () => {
  assert.equal(windowToFromDate("all", 0)?.toISOString(), "1970-01-01T00:00:00.000Z");
});
