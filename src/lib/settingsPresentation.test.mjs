import assert from "node:assert/strict";
import test from "node:test";
import { getSettingsPresentation } from "./settingsPresentation.ts";

test("an unsaved pause leaves saved service open", () => {
  const state = getSettingsPresentation(false, true, true);
  assert.equal(state.savedService, "open");
  assert.equal(state.draftPause, true);
});

test("an unsaved resume leaves saved service paused", () => {
  const state = getSettingsPresentation(true, true, false);
  assert.equal(state.savedService, "paused");
  assert.equal(state.draftPause, false);
});

test("a confirmed save updates service and clears the pause draft", () => {
  const state = getSettingsPresentation(true, true, true);
  assert.equal(state.savedService, "paused");
  assert.equal(state.draftPause, null);
});

test("scheduled closure stays distinct from a pause draft", () => {
  const state = getSettingsPresentation(false, false, true);
  assert.equal(state.savedService, "closed");
  assert.equal(state.draftPause, true);
});

test("missing open status cannot claim saved service is open", () => {
  assert.equal(getSettingsPresentation(false, null, false).savedService, "unknown");
});
