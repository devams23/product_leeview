import assert from "node:assert/strict";
import { test } from "node:test";
import { fluxConfigureFor, parseFlux } from "../src/services/fluxStt.ts";

test("StartOfTurn is a start event", () => {
  assert.deepEqual(parseFlux({ type: "TurnInfo", event: "StartOfTurn", turn_index: 2, transcript: "" }), {
    kind: "start",
    turnIndex: 2,
    transcript: "",
  });
});

test("Update, TurnResumed and EagerEndOfTurn are partial events", () => {
  for (const event of ["Update", "TurnResumed", "EagerEndOfTurn"]) {
    const ev = parseFlux({ type: "TurnInfo", event, turn_index: 3, transcript: "hello there" });
    assert.deepEqual(ev, { kind: "partial", turnIndex: 3, transcript: "hello there" }, event);
  }
});

test("EndOfTurn is an end event carrying the transcript", () => {
  assert.deepEqual(parseFlux({ type: "TurnInfo", event: "EndOfTurn", turn_index: 4, transcript: "done" }), {
    kind: "end",
    turnIndex: 4,
    transcript: "done",
  });
});

test("an unknown TurnInfo event is ignored", () => {
  assert.equal(parseFlux({ type: "TurnInfo", event: "Mystery", turn_index: 1 }).kind, "ignore");
});

test("a non-TurnInfo message is ignored with turnIndex -1", () => {
  assert.deepEqual(parseFlux({ type: "Connected" }), { kind: "ignore", turnIndex: -1, transcript: "" });
  assert.deepEqual(parseFlux({ type: "ConfigureSuccess" }), { kind: "ignore", turnIndex: -1, transcript: "" });
  assert.deepEqual(parseFlux(null), { kind: "ignore", turnIndex: -1, transcript: "" });
});

test("AWAITING_CODE waits longest before ending a turn", () => {
  assert.deepEqual(fluxConfigureFor("AWAITING_CODE"), {
    type: "Configure",
    thresholds: { eot_threshold: 0.8, eot_timeout_ms: 12000 },
  });
});

test("approach and walkthrough get the middle patience", () => {
  for (const stage of ["AWAITING_APPROACH", "AWAITING_WALKTHROUGH"] as const) {
    assert.deepEqual(fluxConfigureFor(stage), {
      type: "Configure",
      thresholds: { eot_threshold: 0.75, eot_timeout_ms: 7000 },
    }, stage);
  }
});

test("other stages and no stage use the default patience", () => {
  const defaults = { type: "Configure", thresholds: { eot_threshold: 0.7, eot_timeout_ms: 5000 } };
  assert.deepEqual(fluxConfigureFor("AWAITING_CLARIFICATION"), defaults);
  assert.deepEqual(fluxConfigureFor("INTRO"), defaults);
  assert.deepEqual(fluxConfigureFor(null), defaults);
});
