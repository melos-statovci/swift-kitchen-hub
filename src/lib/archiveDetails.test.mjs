import test, { after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const cacheDir = await mkdtemp(join(tmpdir(), "swiftkitchen-archive-tests-"));
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
const { ArchiveOrderDetails } = await server.ssrLoadModule(
  "/src/routes/_authenticated/archive.tsx",
);

test("Archive renders historical flat and required-variant names and unit-price snapshots", () => {
  const order = {
    id: "historic-order",
    orderNumber: "H-001",
    status: "DELIVERED",
    fulfillmentType: "PICKUP",
    placedAt: "2026-10-04T22:30:00Z",
    acceptedAt: null,
    deliveredAt: "2026-10-05T00:00:00Z",
    cancelledAt: null,
    declinedAt: null,
    customerName: "Historical Customer",
    customerPhone: "+3816000000",
    customerAddress: null,
    customerNotes: null,
    declineReason: null,
    subtotal: 2600,
    deliveryFee: 0,
    total: 2600,
    items: [
      {
        id: "flat-line",
        quantity: 2,
        nameSnapshot: "Original Flat Dish",
        priceSnapshot: 700,
        variantNameSnapshot: null,
        variantPriceSnapshot: null,
        notes: "Flat note",
      },
      {
        id: "variant-line",
        quantity: 1,
        nameSnapshot: "Original Variant Dish",
        priceSnapshot: 1200,
        variantNameSnapshot: "Large",
        variantPriceSnapshot: 1200,
        notes: "Variant note",
      },
    ],
  };

  const html = renderToStaticMarkup(React.createElement(ArchiveOrderDetails, { order }));
  assert.match(html, /2× Original Flat Dish/);
  assert.match(html, /1× Original Variant Dish/);
  assert.match(html, />Large<\/span>/);
  assert.match(html, /Flat note/);
  assert.match(html, /Variant note/);
  assert.match(html, /14,00/);
  assert.match(html, /12,00/);
  assert.match(html, /26,00/);
  assert.match(html, /Placed: 5\. Okt\. 2026, 00:30/);
});
