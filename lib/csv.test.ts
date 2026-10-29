import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseQuestions } from "./csv.ts";

test("parses quotes, commas and newlines inside fields", () => {
  const rows = parseCsv('a,"b, c","d ""e"""\n"x\ny",2,3\n');
  assert.deepEqual(rows, [["a", "b, c", 'd "e"'], ["x\ny", "2", "3"]]);
});

test("handles BOM, CRLF and blank lines", () => {
  const rows = parseCsv("﻿a,b\r\n\r\nc,d\r\n");
  assert.deepEqual(rows, [["a", "b"], ["c", "d"]]);
});

test("parses valid questions with letter and number answers", () => {
  const csv = [
    "question,option_a,option_b,option_c,option_d,correct",
    "Capital of Bangladesh?,Chattogram,Dhaka,Sylhet,Khulna,B",
    "Water formula?,CO2,O2,H2O,NaCl,3",
  ].join("\n");
  const { valid, errors } = parseQuestions(csv);
  assert.equal(errors.length, 0);
  assert.equal(valid.length, 2);
  assert.equal(valid[0].correct_index, 1);
  assert.equal(valid[1].correct_index, 2);
});

test("reports bad rows and keeps good ones", () => {
  const csv = [
    "question,option_a,option_b,option_c,option_d,correct",
    "Ok?,Yes,No,,,A",
    ",Yes,No,,,A",
    "One option?,Only,,,,A",
    "Out of range?,Yes,No,,,D",
  ].join("\n");
  const { valid, errors } = parseQuestions(csv);
  assert.equal(valid.length, 1);
  assert.equal(errors.length, 3);
});

test("rejects a file with the wrong header", () => {
  const { valid, errors } = parseQuestions("foo,bar\n1,2");
  assert.equal(valid.length, 0);
  assert.equal(errors.length, 1);
});
