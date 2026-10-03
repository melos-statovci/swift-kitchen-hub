import test from "node:test";
import assert from "node:assert/strict";
import { createMenuFormSchema } from "./menuFormSchema.ts";

const fields = {
  name: "Margherita",
  description: "",
  category: "pizza",
  imageUrl: "",
  available: true,
};

test("a required-variant product can return to variants after clearing its flat-price draft", () => {
  const schema = createMenuFormSchema("EUR");
  assert.equal(schema.safeParse({ ...fields, variantMode: "REQUIRED", price: 0 }).success, true);
  assert.equal(
    schema.safeParse({ ...fields, variantMode: "NONE", price: undefined }).success,
    false,
  );
  assert.equal(
    schema.safeParse({ ...fields, variantMode: "REQUIRED", price: undefined }).success,
    true,
  );
});

test("flat-price products still require a valid explicit amount, including a valid zero price", () => {
  const schema = createMenuFormSchema("EUR");
  // The real numeric input converts a cleared field to undefined.
  for (const price of [undefined, "invalid", -1, 1001]) {
    assert.equal(schema.safeParse({ ...fields, variantMode: "NONE", price }).success, false);
  }
  for (const [price, expected] of [
    [0, 0],
    ["0", 0],
    ["4.50", 4.5],
  ]) {
    const result = schema.safeParse({ ...fields, variantMode: "NONE", price });
    assert.equal(result.success, true);
    assert.equal(result.data.price, expected);
  }
});

test("returning to required variants ignores an invalid hidden flat-price draft", () => {
  const schema = createMenuFormSchema("EUR");
  for (const price of [1001, -1, "invalid", null, undefined]) {
    assert.equal(schema.safeParse({ ...fields, variantMode: "REQUIRED", price }).success, true);
  }
});
