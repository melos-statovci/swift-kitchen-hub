import assert from "node:assert/strict";
import test from "node:test";
import { isOrderVisibleToRole } from "./orderVisibility.ts";

test("driver visibility excludes pickup from realtime READY and delivery states", () => {
  assert.equal(
    isOrderVisibleToRole({ status: "READY", fulfillmentType: "PICKUP" }, "driver"),
    false,
  );
  assert.equal(
    isOrderVisibleToRole({ status: "OUT_FOR_DELIVERY", fulfillmentType: "PICKUP" }, "driver"),
    false,
  );
});

test("driver visibility retains delivery and legacy orders", () => {
  assert.equal(
    isOrderVisibleToRole({ status: "READY", fulfillmentType: "DELIVERY" }, "driver"),
    true,
  );
  assert.equal(isOrderVisibleToRole({ status: "READY" }, "driver"), true);
});

test("pickup remains visible to operational non-driver roles", () => {
  assert.equal(
    isOrderVisibleToRole({ status: "PENDING", fulfillmentType: "PICKUP" }, "acceptance"),
    true,
  );
  assert.equal(
    isOrderVisibleToRole({ status: "ACCEPTED", fulfillmentType: "PICKUP" }, "kitchen"),
    true,
  );
});
