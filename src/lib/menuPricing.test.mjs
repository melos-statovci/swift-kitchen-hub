import assert from "node:assert/strict";
import test from "node:test";
import { hiddenForNoOrderableVariant, requiresExplicitFlatPrice } from "./menuPricing.ts";

test("variant to flat requires a newly entered price", () => {
  assert.equal(requiresExplicitFlatPrice("REQUIRED", "NONE"), true);
});

test("other pricing-mode transitions do not clear an existing flat price", () => {
  assert.equal(requiresExplicitFlatPrice("NONE", "REQUIRED"), false);
  assert.equal(requiresExplicitFlatPrice("NONE", "NONE"), false);
  assert.equal(requiresExplicitFlatPrice("REQUIRED", "REQUIRED"), false);
});

test("size-required items without an orderable size are hidden from customers", () => {
  const variant = (available, archivedAt = null) => ({ available, archivedAt });
  assert.equal(
    hiddenForNoOrderableVariant({ variantMode: "REQUIRED", variants: [variant(false)] }),
    true,
  );
  assert.equal(
    hiddenForNoOrderableVariant({
      variantMode: "REQUIRED",
      variants: [variant(true, "2026-10-08T10:00:00.000Z")],
    }),
    true,
  );
  assert.equal(
    hiddenForNoOrderableVariant({ variantMode: "REQUIRED", variants: [variant(true)] }),
    false,
  );
  assert.equal(hiddenForNoOrderableVariant({ variantMode: "NONE", variants: [] }), false);
});
