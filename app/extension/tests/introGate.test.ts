import assert from "node:assert/strict";
import { test } from "node:test";
import { IntroGate } from "../src/content/introGate.ts";

test("holds messages while closed and reports that it took them", () => {
  const gate = new IntroGate<string>();
  assert.equal(gate.offer("a"), true);
  assert.equal(gate.offer("b"), true);
  assert.deepEqual(gate.open(), ["a", "b"]);
});

test("passes messages straight through once open", () => {
  const gate = new IntroGate<string>();
  gate.open();
  assert.equal(gate.offer("c"), false);
  assert.equal(gate.isOpen, true);
});

test("open returns the held messages exactly once", () => {
  const gate = new IntroGate<string>();
  gate.offer("a");
  assert.deepEqual(gate.open(), ["a"]);
  assert.deepEqual(gate.open(), []);
});
