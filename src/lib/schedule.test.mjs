import assert from "node:assert/strict";
import test from "node:test";
import { isValidHoursPair } from "./schedule.ts";

test("accepts ordinary and overnight schedules", () => {
  assert.equal(isValidHoursPair("10:00", "22:00"), true);
  assert.equal(isValidHoursPair("18:00", "02:00"), true);
});

test("rejects equal or malformed schedule endpoints", () => {
  assert.equal(isValidHoursPair("10:00", "10:00"), false);
  assert.equal(isValidHoursPair("25:00", "02:00"), false);
  assert.equal(isValidHoursPair("9:00", "18:00"), false);
});
