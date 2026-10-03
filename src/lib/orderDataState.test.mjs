import assert from "node:assert/strict";
import test from "node:test";
import { getOrderDataState } from "./orderDataState.ts";

test("initial requests cannot imply healthy empty orders", () => {
  assert.equal(getOrderDataState({ loading: true, error: null, hasLoaded: false }), "loading");
  assert.equal(
    getOrderDataState({ loading: false, error: "Network unavailable", hasLoaded: false }),
    "unavailable",
  );
});
test("a successful empty response is ready, not unavailable", () => {
  assert.equal(getOrderDataState({ loading: false, error: null, hasLoaded: true }), "ready");
});
test("failed refresh keeps previously loaded orders visibly stale", () => {
  assert.equal(
    getOrderDataState({ loading: false, error: "Refresh failed", hasLoaded: true }),
    "stale",
  );
  assert.equal(
    getOrderDataState({ loading: true, error: "Refresh failed", hasLoaded: true }),
    "stale",
  );
});
test("loss of previously established realtime connection warns until restored", () => {
  assert.equal(
    getOrderDataState({ loading: false, error: null, hasLoaded: true, connectionLost: true }),
    "stale",
  );
  assert.equal(
    getOrderDataState({ loading: false, error: null, hasLoaded: true, connectionLost: false }),
    "ready",
  );
});
