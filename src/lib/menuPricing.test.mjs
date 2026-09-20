import assert from "node:assert/strict";
import test from "node:test";
import { requiresExplicitFlatPrice } from "./menuPricing.ts";

test("variant to flat requires a newly entered price", () => {
  assert.equal(requiresExplicitFlatPrice("REQUIRED", "NONE"), true);
});

test("other pricing-mode transitions do not clear an existing flat price", () => {
  assert.equal(requiresExplicitFlatPrice("NONE", "REQUIRED"), false);
  assert.equal(requiresExplicitFlatPrice("NONE", "NONE"), false);
  assert.equal(requiresExplicitFlatPrice("REQUIRED", "REQUIRED"), false);
});
