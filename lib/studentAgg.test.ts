import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, statusLabel, genderLabel } from "./studentAgg.ts";
import type { AttemptRow } from "./studentAgg.ts";

const row = (over: Partial<AttemptRow>): AttemptRow => ({
  studentId: "s1", name: "Rahim", phone: "01712345678", gender: null, admissionType: null, center: "A",
  startedAt: "2026-11-01T10:00:00Z", status: "submitted", score: 5, total: 10, ...over,
});

test("one row per student, counting every start including unfinished ones", () => {
  const out = aggregate([
    row({ startedAt: "2026-11-01T10:00:00Z", status: "in_progress", score: null, total: null }),
    row({ startedAt: "2026-11-02T10:00:00Z", status: "submitted", score: 8, total: 10 }),
    row({ startedAt: "2026-11-03T10:00:00Z", status: "expired", score: 6, total: 10, center: "B" }),
    row({ studentId: "s2", name: "Karim", status: "in_progress", score: null, total: null }),
  ]);
  assert.equal(out.length, 2);
  const s1 = out.find((r) => r.studentId === "s1")!;
  assert.equal(s1.attempts, 3);
  assert.equal(s1.finished, 2);
  assert.equal(s1.bestScore, 8);
  assert.equal(s1.firstStart, "2026-11-01T10:00:00Z");
  assert.equal(s1.lastStart, "2026-11-03T10:00:00Z");
  assert.equal(s1.center, "B"); // center of the latest attempt
  const s2 = out.find((r) => r.studentId === "s2")!;
  assert.equal(s2.attempts, 1);
  assert.equal(s2.finished, 0);
  assert.equal(s2.bestScore, null);
});

test("admission type is carried onto the student row", () => {
  const out = aggregate([
    row({ startedAt: "2026-11-01T10:00:00Z", admissionType: null }),
    row({ startedAt: "2026-11-02T10:00:00Z", admissionType: "nursing" }),
  ]);
  assert.equal(out[0].admissionType, "nursing");
});

test("a student who only clicked Start still appears", () => {
  const out = aggregate([row({ status: "in_progress", score: null, total: null })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].finished, 0);
});

test("labels", () => {
  assert.equal(statusLabel("in_progress"), "Started only");
  assert.equal(statusLabel("submitted"), "Finished");
  assert.equal(genderLabel(null), "Not given");
  assert.equal(genderLabel("male"), "Male");
});
