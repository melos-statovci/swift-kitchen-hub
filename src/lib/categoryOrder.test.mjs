import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
test("category hook uses the single complete order contract", async () => {
  const hook = await readFile(new URL("../hooks/useCategories.ts", import.meta.url), "utf8");
  assert.match(hook, /\/api\/categories\/order/);
  assert.doesNotMatch(hook, /Promise\.all/);
});
import { buildCategoryMove, createCategoryMover } from "./categoryOrder.ts";
const cats = [
  { id: "a", name: "A", slug: "a", sortOrder: 0 },
  { id: "b", name: "B", slug: "b", sortOrder: 1 },
  { id: "c", name: "C", slug: "c", sortOrder: 2 },
];
test("builds full expected and target ordering and does nothing at boundaries", () => {
  assert.deepEqual(buildCategoryMove(cats, "b", "up"), {
    expectedOrder: cats.map(({ id, sortOrder }) => ({ id, sortOrder })),
    order: [
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ],
  });
  assert.equal(buildCategoryMove(cats, "a", "up"), null);
  assert.equal(buildCategoryMove(cats, "c", "down"), null);
  const tied = cats.map((c) => ({ ...c, sortOrder: 9 }));
  assert.deepEqual(
    buildCategoryMove(tied, "b", "up").order.map((c) => c.id),
    ["b", "a", "c"],
  );
});
test("one transport, guarded rapid duplicate, canonical response replaces optimism", async () => {
  let current = cats,
    calls = 0,
    resolve,
    sent;
  const flags = [];
  const move = createCategoryMover({
    read: () => current,
    apply: (value) => (current = value),
    pending: (value) => flags.push(value),
    request: (body) => {
      calls++;
      sent = body;
      return new Promise((r) => (resolve = r));
    },
    reload: async () => {
      throw Error("unexpected reload");
    },
  });
  const first = move("b", "up");
  await move("c", "up");
  assert.equal(calls, 1);
  assert.deepEqual(sent, buildCategoryMove(cats, "b", "up"));
  assert.deepEqual(
    current.map((c) => c.id),
    ["b", "a", "c"],
  );
  const canonical = [
    { ...cats[1], name: "Canonical", sortOrder: 0 },
    { ...cats[0], sortOrder: 1 },
    cats[2],
  ];
  resolve({ categories: canonical });
  await first;
  assert.deepEqual(current, canonical);
  assert.deepEqual(flags, [true, false]);
});
test("rejected reorder reloads authoritative categories and preserves the error", async () => {
  let current = cats,
    reloads = 0;
  const move = createCategoryMover({
    read: () => current,
    apply: (value) => (current = value),
    pending: () => {},
    request: async () => {
      throw Error("changed");
    },
    reload: async () => {
      reloads++;
      return { categories: cats };
    },
  });
  await assert.rejects(move("b", "up"), /changed/);
  assert.equal(reloads, 1);
  assert.deepEqual(current, cats);
});
