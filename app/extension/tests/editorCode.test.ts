import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeSavedCode,
  orderVisibleLines,
  pickSavedCode,
  questionIdFromTitle,
  readMonacoCode,
} from "../src/utils/editorCode.ts";

function editor(language: string, value: string, readOnly = false) {
  return {
    getModel: () => ({ getLanguageId: () => language, getValue: () => value }),
    getRawOptions: () => ({ readOnly }),
  };
}

function monaco(editors: unknown[], models: unknown[] = []) {
  return { editor: { getEditors: () => editors, getModels: () => models } } as never;
}

test("reads the code editor, not the plaintext testcase editor beside it", () => {
  const found = readMonacoCode(monaco([editor("plaintext", "[2,7,11,15]\n9"), editor("python", "class Solution:\n    pass")]));
  assert.deepEqual(found, { code: "class Solution:\n    pass", language: "python" });
});

test("skips read-only editors such as a past submission", () => {
  const found = readMonacoCode(monaco([editor("python", "old attempt, much longer than the live one", true), editor("python", "live")]));
  assert.equal(found?.code, "live");
});

test("falls back to models when no editor instance is listed", () => {
  const model = { getLanguageId: () => "java", getValue: () => "class Solution {}" };
  assert.equal(readMonacoCode(monaco([], [model]))?.code, "class Solution {}");
});

test("returns null when Monaco is missing or holds nothing but plaintext", () => {
  assert.equal(readMonacoCode(undefined), null);
  assert.equal(readMonacoCode(monaco([editor("plaintext", "[1,2]")])), null);
});

test("an editor cleared to empty is still the answer, so old saved code is not used", () => {
  assert.deepEqual(readMonacoCode(monaco([editor("python", "")])), { code: "", language: "python" });
});

test("never returns a different problem's newer code", () => {
  const keys = ["1_0_python3", "1_0_python3-updated-time", "207_0_python3", "207_0_python3-updated-time"];
  const values = ["two sum", "100", "course schedule", "999"];
  assert.equal(pickSavedCode(keys, values, "1", "python3"), "two sum");
});

test("matches the language exactly", () => {
  const keys = ["1_0_javascript", "1_0_javascript-updated-time", "1_0_java", "1_0_java-updated-time"];
  const values = ["const a = 1;", "999", "class A {}", "100"];
  assert.equal(pickSavedCode(keys, values, "1", "java"), "class A {}");
});

test("takes the newest save of the same problem and language", () => {
  const keys = ["1_0_cpp", "1_0_cpp-updated-time", "1_7_cpp", "1_7_cpp-updated-time"];
  const values = ["older", "100", "newer", "200"];
  assert.equal(pickSavedCode(keys, values, "1", "cpp"), "newer");
});

test("returns nothing without a question id rather than guessing", () => {
  assert.equal(pickSavedCode(["1_0_cpp"], ["x"], null, "cpp"), "");
});

test("decodes saved code stored as a JSON string", () => {
  assert.equal(decodeSavedCode('"def f():\\n    return \\"a\\""'), 'def f():\n    return "a"');
});

test("keeps plain saved code as it is, including code that starts with a quote", () => {
  assert.equal(decodeSavedCode("x = 1\ny = 2"), "x = 1\ny = 2");
  assert.equal(decodeSavedCode('"use strict";\nlet a;'), '"use strict";\nlet a;');
});

test("ignores saved values that are not text", () => {
  assert.equal(decodeSavedCode(1700000000), "");
  assert.equal(decodeSavedCode(null), "");
});

test("reads the question number from the problem heading", () => {
  assert.equal(questionIdFromTitle("207. Course Schedule"), "207");
  assert.equal(questionIdFromTitle("Course Schedule"), null);
});

test("orders Monaco's rendered lines by position and restores normal spaces", () => {
  const lines = [
    { top: 19, text: "    pass" },
    { top: 0, text: "class Solution:" },
  ];
  assert.equal(orderVisibleLines(lines), "class Solution:\n    pass");
});
