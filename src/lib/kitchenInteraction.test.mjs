import test from "node:test";
import assert from "node:assert/strict";
import { createKitchenActionGate, createKitchenSurfaceGesture } from "./kitchenInteraction.ts";

const order = { id: "synthetic-kitchen-order", status: "ACCEPTED", fulfillmentType: "DELIVERY" };
const request = (overrides = {}) => ({
  order,
  mode: "both",
  source: "surface",
  pending: false,
  expectedStatus: "ACCEPTED",
  ...overrides,
});
// State supplied by a real caller; the async action gate itself remains unmocked.
function fixtureGate() {
  let current;
  const gate = createKitchenActionGate(() => current);
  return {
    run(input, perform) {
      current = input;
      return gate.run(input, perform);
    },
  };
}

const pointer = (overrides = {}) => ({
  pointerId: 1,
  clientX: 40,
  clientY: 50,
  button: 0,
  isPrimary: true,
  mode: "both",
  status: "ACCEPTED",
  pending: false,
  interactive: false,
  ...overrides,
});
const click = (overrides = {}) => ({
  detail: 1,
  button: 0,
  mode: "both",
  status: "ACCEPTED",
  pending: false,
  interactive: false,
  textSelected: false,
  ...overrides,
});

for (const [mode, source, allowed] of [
  ["both", "surface", true],
  ["both", "forward", true],
  ["quickTap", "surface", true],
  ["quickTap", "forward", true],
  ["buttons", "surface", false],
  ["buttons", "forward", true],
]) {
  test(`${mode}: ${source} performs ${allowed ? "one Start" : "no transition"}`, async () => {
    const actions = [];
    const gate = fixtureGate();
    const performed = await gate.run(request({ mode, source }), async (action, id) =>
      actions.push([action, id]),
    );
    assert.equal(performed, allowed);
    assert.deepEqual(actions, allowed ? [["start", "synthetic-kitchen-order"]] : []);
  });
}

test("a forward interaction in progress performs only Ready", async () => {
  const actions = [];
  await fixtureGate().run(
    request({ order: { ...order, status: "IN_PROGRESS" }, expectedStatus: "IN_PROGRESS" }),
    async (action) => actions.push(action),
  );
  assert.deepEqual(actions, ["ready"]);
});

for (const mode of ["quickTap", "buttons", "both"]) {
  test(`${mode}: Move back remains an explicit reverse operation`, async () => {
    const actions = [];
    await fixtureGate().run(
      request({
        mode,
        source: "back",
        order: { ...order, status: "READY" },
        expectedStatus: "READY",
      }),
      async (action) => actions.push(action),
    );
    assert.deepEqual(actions, ["back"]);
  });
}

test("ready and unsupported tickets never advance, and waiting tickets never move back", async () => {
  const actions = [];
  const gate = fixtureGate();
  for (const status of ["READY", "PENDING", "DELIVERED", "CANCELLED", "DECLINED"]) {
    assert.equal(
      await gate.run(
        request({ order: { ...order, status }, expectedStatus: status }),
        async (action) => actions.push(action),
      ),
      false,
    );
  }
  assert.equal(
    await gate.run(request({ source: "back" }), async (action) => actions.push(action)),
    false,
  );
  assert.deepEqual(actions, []);
});

test("rapid mixed interactions submit once until the mutation completes", async () => {
  const gate = fixtureGate();
  const actions = [];
  let finish;
  const first = gate.run(request(), (action) => {
    actions.push(action);
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  assert.equal(
    await gate.run(request({ source: "forward" }), async (action) => actions.push(action)),
    false,
  );
  assert.equal(await gate.run(request(), async (action) => actions.push(action)), false);
  assert.deepEqual(actions, ["start"]);
  finish();
  assert.equal(await first, true);
});

test("pending state and a changed realtime status reject an obsolete interaction", async () => {
  const actions = [];
  const gate = fixtureGate();
  assert.equal(
    await gate.run(request({ pending: true }), async (action) => actions.push(action)),
    false,
  );
  assert.equal(
    await gate.run(request({ order: { ...order, status: "IN_PROGRESS" } }), async (action) =>
      actions.push(action),
    ),
    false,
  );
  assert.deepEqual(actions, []);
});

test("an exiting ticket handler checks live state after a realtime lane move", async () => {
  let current = request();
  const gate = createKitchenActionGate(() => current);
  const actions = [];
  const oldTicketHandler = () => gate.run(request(), async (action) => actions.push(action));
  current = request({ order: { ...order, status: "IN_PROGRESS" } });
  assert.equal(await oldTicketHandler(), false);
  assert.deepEqual(actions, []);
});

test("an exiting ticket handler respects a newly selected Buttons only mode", async () => {
  let current = request();
  const gate = createKitchenActionGate(() => current);
  current = request({ mode: "buttons" });
  const actions = [];
  assert.equal(await gate.run(request(), async (action) => actions.push(action)), false);
  assert.deepEqual(actions, []);
});

test("an exiting Ready ticket cannot reverse twice after a realtime move back", async () => {
  const current = request({ order: { ...order, status: "IN_PROGRESS" } });
  const gate = createKitchenActionGate(() => current);
  const actions = [];
  const oldReadyControl = () =>
    gate.run(request({ source: "back", expectedStatus: "READY" }), async (action) =>
      actions.push(action),
    );
  assert.equal(await oldReadyControl(), false);
  assert.deepEqual(actions, []);
});

test("a failed operation releases the guard so an explicit retry is possible", async () => {
  const gate = fixtureGate();
  await assert.rejects(
    gate.run(request(), async () => {
      throw new Error("Network failure");
    }),
    /Network failure/,
  );
  const actions = [];
  assert.equal(await gate.run(request(), async (action) => actions.push(action)), true);
  assert.deepEqual(actions, ["start"]);
});

test("Delivery and Pickup tickets retain the same valid kitchen transition", async () => {
  for (const fulfillmentType of ["DELIVERY", "PICKUP"]) {
    const actions = [];
    await fixtureGate().run(request({ order: { ...order, fulfillmentType } }), async (action) =>
      actions.push(action),
    );
    assert.deepEqual(actions, ["start"]);
  }
});

for (const mode of ["quickTap", "buttons", "both"]) {
  test(`${mode}: only an eligible surface tap is consumed once`, () => {
    const gesture = createKitchenSurfaceGesture();
    gesture.start(pointer({ mode }));
    gesture.end(1, 40, 50);
    assert.equal(gesture.consume(click({ mode })), mode !== "buttons");
    assert.equal(gesture.consume(click({ mode })), false);
  });
  test(`${mode}: interactive children and notes/details never advance`, () => {
    const gesture = createKitchenSurfaceGesture();
    gesture.start(pointer({ mode, interactive: true }));
    gesture.end(1, 40, 50);
    assert.equal(gesture.consume(click({ mode, interactive: true })), false);
    gesture.start(pointer({ mode }));
    gesture.end(1, 40, 50);
    assert.equal(gesture.consume(click({ mode, interactive: true })), false);
  });
}

test("touch movement, cancelled scrolling and secondary pointers are not taps", () => {
  const gesture = createKitchenSurfaceGesture();
  gesture.start(pointer());
  gesture.move({ pointerId: 1, clientX: 40, clientY: 80 });
  gesture.end(1, 40, 50);
  assert.equal(gesture.consume(click()), false);
  gesture.start(pointer());
  gesture.cancel();
  gesture.end(1, 40, 50);
  assert.equal(gesture.consume(click()), false);
  gesture.start(pointer({ isPrimary: false }));
  gesture.end(1, 40, 50);
  assert.equal(gesture.consume(click()), false);
});

test("a displaced pointer release is not a tap even when no move event was received", () => {
  const gesture = createKitchenSurfaceGesture();
  gesture.start(pointer());
  gesture.end(1, 40, 80);
  assert.equal(gesture.consume(click()), false);
});

test("text selection, double clicks, pending state and realtime changes suppress advancement", () => {
  const gesture = createKitchenSurfaceGesture();
  for (const overrides of [
    { textSelected: true },
    { detail: 2 },
    { pending: true },
    { status: "IN_PROGRESS" },
  ]) {
    gesture.start(pointer());
    gesture.end(1, 40, 50);
    assert.equal(gesture.consume(click(overrides)), false);
  }
});
