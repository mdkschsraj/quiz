import { test } from "node:test";
import assert from "node:assert/strict";
import { bestAttempts, meetsGroup, secureShuffle, selectWinners } from "./draw.ts";
import type { Candidate } from "./draw.ts";

const cand = (id: string, score: number, total = 10): Candidate => ({ studentId: id, attemptId: "a-" + id, score, total });

test("best attempt per student: highest percentage, ties to the later submission", () => {
  const out = bestAttempts([
    { studentId: "s1", attemptId: "a1", score: 7, total: 10, submittedAt: "2026-11-01T10:00:00Z" },
    { studentId: "s1", attemptId: "a2", score: 9, total: 10, submittedAt: "2026-11-02T10:00:00Z" },
    { studentId: "s1", attemptId: "a3", score: 9, total: 10, submittedAt: "2026-11-03T10:00:00Z" },
    { studentId: "s2", attemptId: "b1", score: 5, total: 5, submittedAt: "2026-11-01T10:00:00Z" },
    { studentId: "s3", attemptId: "c1", score: 1, total: 0, submittedAt: "2026-11-01T10:00:00Z" },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out.find((c) => c.studentId === "s1")?.attemptId, "a3");
  assert.equal(out.find((c) => c.studentId === "s2")?.score, 5);
});

test("group threshold uses exact fractions", () => {
  assert.equal(meetsGroup(cand("a", 10), 100), true);
  assert.equal(meetsGroup(cand("a", 9), 100), false);
  assert.equal(meetsGroup(cand("a", 9), 90), true);
  assert.equal(meetsGroup(cand("a", 8), 90), false);
  assert.equal(meetsGroup(cand("a", 29, 30), 97), false); // 96.67%
  assert.equal(meetsGroup(cand("a", 29, 30), 96), true);
});

test("shuffle keeps every item exactly once", () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const out = secureShuffle(items);
  assert.deepEqual([...out].sort((a, b) => a - b), items);
});

test("without multi-group wins, a winner is removed from later groups", () => {
  const pool = [cand("p1", 10), cand("p2", 10), cand("n1", 9), cand("n2", 9)];
  const groups = [
    { id: "g90", name: "9/10+", minPercent: 90, winners: 4 },
    { id: "g100", name: "10/10", minPercent: 100, winners: 1 },
  ];
  const { picks, eligibleCounts } = selectWinners(pool, groups, false, () => 0);
  const top = picks.filter((p) => p.groupId === "g100");
  const second = picks.filter((p) => p.groupId === "g90");
  assert.equal(top.length, 1);
  assert.equal(eligibleCounts["g100"], 2);
  assert.equal(eligibleCounts["g90"], 3); // 4 eligible minus the 10/10 winner
  assert.equal(second.length, 3);
  const all = picks.map((p) => p.studentId);
  assert.equal(new Set(all).size, all.length);
});

test("with multi-group wins, a perfect scorer can win in both groups", () => {
  const pool = [cand("p1", 10)];
  const groups = [
    { id: "g100", name: "10/10", minPercent: 100, winners: 1 },
    { id: "g90", name: "9/10+", minPercent: 90, winners: 1 },
  ];
  const { picks } = selectWinners(pool, groups, true, () => 0);
  assert.equal(picks.length, 2);
});

test("asking for more winners than eligible returns only the pool", () => {
  const { picks } = selectWinners([cand("a", 10), cand("b", 10)], [{ id: "g", name: "x", minPercent: 100, winners: 5 }], false);
  assert.equal(picks.length, 2);
  assert.deepEqual(picks.map((p) => p.position), [1, 2]);
});

test("nobody eligible gives no winners", () => {
  const { picks, eligibleCounts } = selectWinners([cand("a", 3)], [{ id: "g", name: "x", minPercent: 100, winners: 2 }], false);
  assert.equal(picks.length, 0);
  assert.equal(eligibleCounts["g"], 0);
});
