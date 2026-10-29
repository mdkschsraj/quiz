import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, sameName } from "./phone.ts";

test("normalizes common Bangladeshi formats to one canonical value", () => {
  for (const v of ["01712345678", "+8801712345678", "8801712345678", "1712345678", "017-1234 5678", "008801712345678"]) {
    assert.equal(normalizePhone(v), "01712345678", v);
  }
});

test("rejects invalid numbers", () => {
  for (const v of ["", "12345", "02712345678", "0171234567", "abcdefghijk", "01212345678"]) {
    assert.equal(normalizePhone(v), null, v);
  }
});

test("name comparison ignores case and extra spaces", () => {
  assert.equal(sameName("Rahim  Uddin", "rahim uddin"), true);
  assert.equal(sameName("Rahim", "Karim"), false);
});
