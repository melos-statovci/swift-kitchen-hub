import test, { after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { formatBusinessDateTime } from "./businessTime.ts";

const cacheDir = await mkdtemp(join(tmpdir(), "swiftkitchen-business-time-tests-"));
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
const { formatTime, formatDateTime } = await server.ssrLoadModule("/src/lib/format.ts");

function inHostZone(zone, callback) {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return callback();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

test("operational clock shows configured business time regardless of browser zone", () => {
  const instant = "2026-10-04T22:30:00Z";
  assert.equal(
    inHostZone("UTC", () => formatTime(instant)),
    "00:30",
  );
  assert.equal(
    inHostZone("America/Los_Angeles", () => formatTime(instant)),
    "00:30",
  );
});

test("archive timestamp shows the business date and clock regardless of browser zone", () => {
  const instant = "2026-10-04T22:30:00Z";
  assert.equal(
    inHostZone("UTC", () => formatDateTime(instant)),
    "5. Okt. 2026, 00:30",
  );
  assert.equal(
    inHostZone("America/Los_Angeles", () => formatDateTime(instant)),
    "5. Okt. 2026, 00:30",
  );
});

test("business clock honors spring DST jump without changing UTC instants", () => {
  assert.equal(
    inHostZone("UTC", () => formatTime("2026-03-29T00:30:00Z")),
    "01:30",
  );
  assert.equal(
    inHostZone("UTC", () => formatTime("2026-03-29T01:30:00Z")),
    "03:30",
  );
});

test("a second restaurant configuration displays the same instant in its own locale and zone", () => {
  assert.equal(
    formatBusinessDateTime("2026-10-04T22:30:00Z", "en-GB", "America/New_York"),
    "4 Oct 2026, 18:30",
  );
});
