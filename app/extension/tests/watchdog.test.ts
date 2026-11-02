import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PREPARE_TIMEOUT_MS,
  SPEAKING_STALL_MS,
  THINKING_TIMEOUT_MS,
  watchdogDelay,
} from "../src/content/watchdog.ts";

test("THINKING waits for the long turn timeout", () => {
  assert.equal(watchdogDelay("THINKING"), THINKING_TIMEOUT_MS);
});

test("AI_SPEAKING waits for the stall timeout", () => {
  assert.equal(watchdogDelay("AI_SPEAKING"), SPEAKING_STALL_MS);
});

test("PREPARING waits for the prepare timeout", () => {
  assert.equal(watchdogDelay("PREPARING"), PREPARE_TIMEOUT_MS);
});

test("every other phase has no watchdog", () => {
  for (const phase of ["IDLE", "PREFLIGHT", "CONNECTING", "LISTENING", "GENERATING_DEBRIEF", "DEBRIEF_READY", "ERROR"] as const) {
    assert.equal(watchdogDelay(phase), null, phase);
  }
});
