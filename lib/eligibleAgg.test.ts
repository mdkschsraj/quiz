import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEligible } from "./eligibleAgg.ts";
import type { AttemptIn } from "./eligibleAgg.ts";

const a = (over: Partial<AttemptIn>): AttemptIn => ({
  attemptId: "a1", studentId: "s1", score: 5, total: 10, submittedAt: "2026-11-02T10:00:00Z",
  name: "Rahim", phone: "01712345678", gender: "male", admissionType: "medical", center: "A", ...over,
});
const groups = [
  { id: "g100", name: "10/10", minPercent: 100 },
  { id: "g90", name: "9/10 and up", minPercent: 90 },
];
const none = { allowPreviousWinners: false, earlierWinnerIds: new Set<string>(), wonByStudent: new Map<string, string[]>() };

test("one row per student, best quiz, count of quizzes and groups qualified", () => {
  const rows = buildEligible([
    a({ attemptId: "a1", score: 6 }),
    a({ attemptId: "a2", score: 9, center: "B", submittedAt: "2026-11-03T10:00:00Z" }),
    a({ attemptId: "b1", studentId: "s2", name: "Karim", score: 10 }),
  ], groups, none);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Karim");              // highest first
  assert.deepEqual(rows[0].qualifiesFor, ["10/10", "9/10 and up"]);
  const r = rows.find((x) => x.studentId === "s1")!;
  assert.equal(r.score, 9);
  assert.equal(r.center, "B");                      // center of the best quiz
  assert.equal(r.quizzes, 2);
  assert.equal(r.percent, 90);
  assert.equal(r.admissionType, "medical");
  assert.deepEqual(r.qualifiesFor, ["9/10 and up"]);
});

test("flags winners of this draw and of earlier draws", () => {
  const rows = buildEligible(
    [a({ attemptId: "a1", studentId: "s1", score: 10 }), a({ attemptId: "b1", studentId: "s2", name: "Karim", score: 7 })],
    groups,
    { allowPreviousWinners: false, earlierWinnerIds: new Set(["s2"]), wonByStudent: new Map([["s1", ["10/10"]]]) }
  );
  const s1 = rows.find((r) => r.studentId === "s1")!;
  const s2 = rows.find((r) => r.studentId === "s2")!;
  assert.deepEqual(s1.wonGroups, ["10/10"]);
  assert.equal(s1.inPool, true);
  assert.equal(s2.wonEarlier, true);
  assert.equal(s2.inPool, false);                   // excluded because earlier winners cannot win again
});

test("earlier winners stay in the pool when the draw allows them", () => {
  const rows = buildEligible([a({})], groups, { ...none, allowPreviousWinners: true, earlierWinnerIds: new Set(["s1"]) });
  assert.equal(rows[0].wonEarlier, true);
  assert.equal(rows[0].inPool, true);
});

test("no attempts gives an empty list", () => {
  assert.deepEqual(buildEligible([], groups, none), []);
});
