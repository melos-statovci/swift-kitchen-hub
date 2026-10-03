import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  createOrderActionTracker,
  mergeOrderSnapshot,
  observeOrderConnection,
} from "./orderSync.ts";

for (const outcome of ["success", "failure"]) {
  test(`a late HTTP ${outcome} cannot overwrite a newer server update`, () => {
    const tracker = createOrderActionTracker();
    let displayed = "ACCEPTED";
    assert.equal(tracker.begin("a"), true);
    displayed = "IN_PROGRESS";
    tracker.noteServerEvent("a");
    displayed = "READY";
    tracker.applyIfCurrent("a", () => {
      displayed = outcome === "failure" ? "ACCEPTED" : "IN_PROGRESS";
    });
    assert.equal(displayed, "READY");
    assert.equal(
      tracker.finish("a"),
      true,
      "a server conflict requests reconciliation after pending clears",
    );
    assert.deepEqual([...tracker.ids()], []);
  });
}

test("ordinary action settlement applies and releases the per-order duplicate guard", () => {
  const tracker = createOrderActionTracker();
  assert.equal(tracker.begin("a"), true);
  assert.equal(tracker.begin("a"), false);
  tracker.noteServerEvent("other-order");
  let displayed = "IN_PROGRESS";
  tracker.applyIfCurrent("a", () => {
    displayed = "ACCEPTED";
  });
  assert.equal(displayed, "ACCEPTED");
  assert.equal(tracker.finish("a"), false);
  assert.equal(tracker.begin("a"), true);
});

test("a removed order stays removed when an older HTTP result arrives", () => {
  const tracker = createOrderActionTracker();
  tracker.begin("a");
  tracker.noteServerEvent("a");
  const displayed = [];
  tracker.applyIfCurrent("a", () => displayed.push({ id: "a", status: "READY" }));
  assert.deepEqual(displayed, []);
});

test("late refresh cannot undo an updated order, lose a new order or resurrect a removed order", () => {
  const snapshot = [
    { id: "a", status: "PENDING" },
    { id: "removed", status: "READY" },
    { id: "stable", status: "READY" },
  ];
  const current = [
    { id: "a", status: "ACCEPTED" },
    { id: "new", status: "PENDING" },
  ];
  assert.deepEqual(mergeOrderSnapshot(snapshot, current, new Set(["a", "new", "removed"])), [
    { id: "stable", status: "READY" },
    { id: "a", status: "ACCEPTED" },
    { id: "new", status: "PENDING" },
  ]);
});
test("a refresh during a pending action preserves its displayed state", () => {
  assert.deepEqual(
    mergeOrderSnapshot(
      [{ id: "a", status: "PENDING" }],
      [{ id: "a", status: "ACCEPTED" }],
      new Set(["a"]),
    ),
    [{ id: "a", status: "ACCEPTED" }],
  );
});
test("an untouched refresh replaces the old snapshot with current server data", () => {
  assert.deepEqual(
    mergeOrderSnapshot([{ id: "b", status: "READY" }], [{ id: "a", status: "PENDING" }], new Set()),
    [{ id: "b", status: "READY" }],
  );
});
test("mounting on an already disconnected socket warns and recovers on the next connect", () => {
  const socket = new EventEmitter();
  socket.connected = false;
  const states = [];
  let recoveries = 0;
  const cleanup = observeOrderConnection(
    socket,
    (state) => states.push(state),
    () => recoveries++,
  );
  assert.deepEqual(states, [true]);
  socket.connected = true;
  socket.emit("connect");
  assert.deepEqual(states, [true, false]);
  assert.equal(recoveries, 1);
  cleanup();
  socket.emit("disconnect");
  assert.deepEqual(states, [true, false]);
});
test("a connected socket recovers once per interruption and removes listeners on cleanup", () => {
  const socket = new EventEmitter();
  socket.connected = true;
  const states = [];
  let recoveries = 0;
  const cleanup = observeOrderConnection(
    socket,
    (state) => states.push(state),
    () => recoveries++,
  );
  socket.emit("connect");
  assert.equal(recoveries, 0);
  socket.emit("disconnect");
  socket.emit("connect_error");
  socket.emit("connect");
  socket.emit("connect");
  assert.equal(recoveries, 1);
  assert.equal(states.at(-1), false);
  cleanup();
  assert.equal(socket.listenerCount("connect"), 0);
  assert.equal(socket.listenerCount("disconnect"), 0);
  assert.equal(socket.listenerCount("connect_error"), 0);
});
