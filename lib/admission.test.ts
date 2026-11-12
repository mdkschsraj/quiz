import { test } from "node:test";
import assert from "node:assert/strict";
import { admissionLabel, parseAdmission } from "./admission.ts";

test("accepts only the four admission types", () => {
  assert.equal(parseAdmission("medical"), "medical");
  assert.equal(parseAdmission("nursing"), "nursing");
  assert.equal(parseAdmission("a_unit"), "a_unit");
  assert.equal(parseAdmission("other_unit"), "other_unit");
  for (const bad of ["", "Medical", "dental", null, undefined, 5, "a unit"]) {
    assert.equal(parseAdmission(bad), null, String(bad));
  }
});

test("labels read naturally and missing values say Not given", () => {
  assert.equal(admissionLabel("a_unit"), "A Unit");
  assert.equal(admissionLabel("other_unit"), "Other Unit");
  assert.equal(admissionLabel(null), "Not given");
  assert.equal(admissionLabel("junk"), "Not given");
});
