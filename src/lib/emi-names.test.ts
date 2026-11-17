import test from "node:test";
import assert from "node:assert/strict";
import { formatEmiNumbers, getEmiOrdinal } from "./emi-names";

test("getEmiOrdinal returns Hindi word with English suffix", () => {
  assert.equal(getEmiOrdinal(1), "Pehli (1st)");
  assert.equal(getEmiOrdinal(2), "Dusri (2nd)");
  assert.equal(getEmiOrdinal(3), "Teesri (3rd)");
  assert.equal(getEmiOrdinal(4), "Chauthi (4th)");
  assert.equal(getEmiOrdinal(5), "Paanchvi (5th)");
  assert.equal(getEmiOrdinal(10), "Dasvi (10th)");
  assert.equal(getEmiOrdinal(31), "31st");
  assert.equal(getEmiOrdinal(32), "32nd");
});

test("formatEmiNumbers formats single EMI correctly", () => {
  assert.equal(formatEmiNumbers([1]), "EMI #1 · Pehli (1st)");
  assert.equal(formatEmiNumbers([2]), "EMI #2 · Dusri (2nd)");
  assert.equal(formatEmiNumbers([3]), "EMI #3 · Teesri (3rd)");
});

test("formatEmiNumbers handles multiple and duplicate EMI numbers", () => {
  assert.equal(formatEmiNumbers([1, 2]), "EMI #1, #2 (Pehli, Dusri)");
  assert.equal(formatEmiNumbers([2, 1, 2]), "EMI #1, #2 (Pehli, Dusri)");
  assert.equal(formatEmiNumbers([1, 2, 3]), "EMI #1, #2, #3 (Pehli, Dusri, Teesri)");
});

test("formatEmiNumbers handles empty and invalid inputs gracefully", () => {
  assert.equal(formatEmiNumbers([]), "—");
  assert.equal(formatEmiNumbers(null), "—");
  assert.equal(formatEmiNumbers(undefined), "—");
  assert.equal(formatEmiNumbers([0, -1]), "—");
});
