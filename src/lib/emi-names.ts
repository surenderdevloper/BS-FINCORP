/**
 * English ordinals and formatted descriptions for EMI instalments
 * (e.g., 1st EMI, 2nd EMI, 3rd EMI... / EMI #1 (1st EMI)).
 */

export function getEmiOrdinal(emiNo: number): string {
  const rem10 = emiNo % 10;
  const rem100 = emiNo % 100;
  if (rem10 === 1 && rem100 !== 11) return `${emiNo}st`;
  if (rem10 === 2 && rem100 !== 12) return `${emiNo}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${emiNo}rd`;
  return `${emiNo}th`;
}

/**
 * Format an array of EMI numbers into a clean English label.
 * E.g. [1] -> "EMI #1 (1st EMI)"
 *      [2] -> "EMI #2 (2nd EMI)"
 *      [1, 2] -> "EMI #1, #2 (1st, 2nd EMI)"
 */
export function formatEmiNumbers(numbers?: number[] | null): string {
  if (!numbers || numbers.length === 0) return "—";
  const unique = Array.from(new Set(numbers.filter((n) => typeof n === "number" && n > 0))).sort(
    (a, b) => a - b
  );
  if (unique.length === 0) return "—";

  if (unique.length === 1) {
    const num = unique[0];
    return `EMI #${num} (${getEmiOrdinal(num)} EMI)`;
  }

  const numPart = unique.map((n) => `#${n}`).join(", ");
  const ordinals = unique.map((n) => getEmiOrdinal(n)).join(", ");
  return `EMI ${numPart} (${ordinals} EMI)`;
}
