import test, { after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

// Use the project's existing TSX transformer and real components, without a
// listening server, browser, production Vite config, or dependency installation.
const cacheDir = await mkdtemp(join(tmpdir(), "swiftkitchen-card-tests-"));
const server = await createServer({
  configFile: false,
  cacheDir,
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  logLevel: "error",
});
after(async () => {
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
});
const { KitchenCard } = await server.ssrLoadModule("/src/components/kitchen/KitchenCard.tsx");
const { KitchenInteractionControl } = await server.ssrLoadModule(
  "/src/components/kitchen/KitchenInteractionControl.tsx",
);
const order = {
  id: "synthetic-ticket",
  orderNumber: "TEST",
  status: "ACCEPTED",
  fulfillmentType: "PICKUP",
  placedAt: "2026-10-03T12:00:00Z",
  customerName: "Arbër Shala",
  customerNotes: "Salca veçmas",
  items: [
    {
      id: "item",
      quantity: 1,
      nameSnapshot: "Sandwich Tuna",
      variantNameSnapshot: null,
      notes: "Pa qepë",
    },
  ],
};

function render(mode, status = "ACCEPTED") {
  return renderToStaticMarkup(
    React.createElement(KitchenCard, {
      order: { ...order, status },
      pending: false,
      interactionMode: mode,
      onSurfaceAdvance() {},
      onStart() {},
      onMarkReady() {},
      onMoveBack() {},
    }),
  );
}

for (const mode of ["quickTap", "buttons", "both"]) {
  test(`${mode}: real tickets retain native keyboard-accessible forward controls`, () => {
    assert.match(render(mode), /<button\b[^>]*>Start<\/button>/);
    assert.match(render(mode, "IN_PROGRESS"), /<button\b[^>]*>Mark ready<\/button>/);
    assert.match(render(mode, "READY"), /<button\b[^>]*>Move back<\/button>/);
  });
  test(`${mode}: real note regions are outside the forward-tap target`, () => {
    const html = render(mode);
    assert.match(html, /data-kitchen-no-advance="[^"]*"[^>]*>.*?Order note.*?Salca veçmas/s);
    assert.match(html, /data-kitchen-no-advance="[^"]*"[^>]*>↳\s*Pa qepë/s);
  });
}

test("Buttons only has no surface-action hint while the tap modes describe advancement", () => {
  assert.doesNotMatch(render("buttons"), /Tap ticket to/);
  assert.match(render("quickTap"), /Tap ticket to/);
  assert.match(render("both"), /Tap ticket to/);
  assert.doesNotMatch(render("both", "READY"), /Tap ticket to/);
});

test("Kitchen has its own native device-controls entry without requiring restaurant settings", () => {
  const html = renderToStaticMarkup(React.createElement(KitchenInteractionControl));
  assert.match(
    html,
    /<button\b[^>]*aria-label="Kitchen controls for this device"[^>]*>Controls<\/button>/,
  );
});
