import assert from "node:assert/strict";
import test from "node:test";
import { kitchenActionsForStatus } from "./kitchenActions.ts";

test("accepted orders only offer the forward start action", () => {
  assert.deepEqual(kitchenActionsForStatus("ACCEPTED"), {
    primary: "start",
    canMoveBack: false,
  });
});

test("orders in progress offer ready and move back", () => {
  assert.deepEqual(kitchenActionsForStatus("IN_PROGRESS"), {
    primary: "ready",
    canMoveBack: true,
  });
});

test("ready orders only offer move back", () => {
  assert.deepEqual(kitchenActionsForStatus("READY"), {
    primary: null,
    canMoveBack: true,
  });
});

test("unsupported statuses offer no kitchen transitions", () => {
  for (const status of ["PENDING", "OUT_FOR_DELIVERY", "DELIVERED", "DECLINED", "CANCELLED"]) {
    assert.deepEqual(kitchenActionsForStatus(status), {
      primary: null,
      canMoveBack: false,
    });
  }
});
