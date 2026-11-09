import assert from "node:assert/strict";
import { test } from "node:test";
import { keyProblem, refusalProblem } from "../src/services/serverErrors.ts";

const DEEPGRAM_MISSING = "Your Deepgram key is missing. Add it on your LeeView profile.";

test("a missing key keeps the server's message naming the key", () => {
  const problem = keyProblem(412, { detail: { code: "KEYS_MISSING", missing: ["deepgram"], message: DEEPGRAM_MISSING } });
  assert.deepEqual(problem, { code: "KEYS_MISSING", message: DEEPGRAM_MISSING });
});

test("a key the provider refused is told apart from a missing one", () => {
  const problem = keyProblem(412, { detail: { code: "KEY_REJECTED", message: "Deepgram rejected your API key." } });
  assert.equal(problem?.code, "KEY_REJECTED");
  assert.equal(problem?.message, "Deepgram rejected your API key.");
});

test("a server without an encryption key is a setup problem, not a network one", () => {
  const problem = keyProblem(503, { detail: { code: "KEY_STORE_UNAVAILABLE", message: "KEY_ENCRYPTION_KEY is not set." } });
  assert.equal(problem?.code, "SERVER_SETUP");
});

test("a bare 412 still reads as missing keys; other failures are not key problems", () => {
  assert.equal(keyProblem(412, null)?.code, "KEYS_MISSING");
  assert.equal(keyProblem(502, { detail: "Could not create interview session" }), null);
  assert.equal(keyProblem(503, null), null);
});

test("a refused socket carries the message sent before the close", () => {
  assert.deepEqual(refusalProblem("KEYS_MISSING", DEEPGRAM_MISSING), { code: "KEYS_MISSING", message: DEEPGRAM_MISSING });
  assert.equal(refusalProblem("KEY_STORE_UNAVAILABLE").code, "SERVER_SETUP");
  assert.equal(refusalProblem("SESSION_ENDED").code, "SESSION_ENDED");
  assert.equal(refusalProblem("").code, "AUTH_EXPIRED");
});
