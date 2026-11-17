import test from "node:test";
import assert from "node:assert/strict";
import { formatEmiNumbers, getEmiOrdinal } from "./emi-names";

test("getEmiOrdinal returns clean English ordinals", () => {
  assert.equal(getEmiOrdinal(1), "1st");
  assert.equal(getEmiOrdinal(2), "2nd");
  assert.equal(getEmiOrdinal(3), "3rd");
  assert.equal(getEmiOrdinal(4), "4th");
  assert.equal(getEmiOrdinal(5), "5th");
  assert.equal(getEmiOrdinal(10), "10th");
  assert.equal(getEmiOrdinal(11), "11th");
  assert.equal(getEmiOrdinal(12), "12th");
  assert.equal(getEmiOrdinal(13), "13th");
  assert.equal(getEmiOrdinal(21), "21st");
  assert.equal(getEmiOrdinal(22), "22nd");
  assert.equal(getEmiOrdinal(23), "23rd");
  assert.equal(getEmiOrdinal(31), "31st");
  assert.equal(getEmiOrdinal(32), "32nd");
});

test("formatEmiNumbers formats single EMI in English correctly", () => {
  assert.equal(formatEmiNumbers([1]), "EMI #1 (1st EMI)");
  assert.equal(formatEmiNumbers([2]), "EMI #2 (2nd EMI)");
  assert.equal(formatEmiNumbers([3]), "EMI #3 (3rd EMI)");
  assert.equal(formatEmiNumbers([4]), "EMI #4 (4th EMI)");
  assert.equal(formatEmiNumbers([5]), "EMI #5 (5th EMI)");
});

test("formatEmiNumbers handles multiple and duplicate EMI numbers in English", () => {
  assert.equal(formatEmiNumbers([1, 2]), "EMI #1, #2 (1st, 2nd EMI)");
  assert.equal(formatEmiNumbers([2, 1, 2]), "EMI #1, #2 (1st, 2nd EMI)");
  assert.equal(formatEmiNumbers([1, 2, 3]), "EMI #1, #2, #3 (1st, 2nd, 3rd EMI)");
});

test("formatEmiNumbers handles empty and invalid inputs gracefully", () => {
  assert.equal(formatEmiNumbers([]), "—");
  assert.equal(formatEmiNumbers(null), "—");
  assert.equal(formatEmiNumbers(undefined), "—");
  assert.equal(formatEmiNumbers([0, -1]), "—");
});
