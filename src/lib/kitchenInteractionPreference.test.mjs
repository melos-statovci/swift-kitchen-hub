import test from "node:test";
import assert from "node:assert/strict";
import {
  readKitchenInteractionMode,
  writeKitchenInteractionMode,
} from "./kitchenInteractionPreference.ts";

function storage(initial) {
  const values = new Map(
    initial === undefined ? [] : [["swiftKitchen.kitchenInteractionMode", initial]],
  );
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("missing and corrupt device preferences safely use Both", () => {
  for (const value of [undefined, "", "invalid", '"buttons"', "null"]) {
    assert.equal(readKitchenInteractionMode(storage(value)), "both");
  }
});

for (const mode of ["quickTap", "buttons", "both"]) {
  test(`${mode} is retained when a new reader loads the device preference`, () => {
    const device = storage();
    assert.equal(writeKitchenInteractionMode(device, mode), true);
    assert.equal(readKitchenInteractionMode(device), mode);
    assert.equal(device.getItem("swiftKitchen.kitchenInteractionMode"), mode);
  });
}

test("a device preference does not change a different device", () => {
  const touchscreen = storage();
  const office = storage();
  writeKitchenInteractionMode(touchscreen, "quickTap");
  assert.equal(readKitchenInteractionMode(office), "both");
});

test("blocked browser storage remains safe and reports an unsuccessful write", () => {
  const blocked = {
    getItem() {
      throw new Error("Storage unavailable");
    },
    setItem() {
      throw new Error("Storage unavailable");
    },
  };
  assert.equal(readKitchenInteractionMode(blocked), "both");
  assert.equal(writeKitchenInteractionMode(blocked, "buttons"), false);
});
