/**
 * Hindi ordinals and formatted descriptions for EMI instalments
 * (e.g., Pehli, Dusri, Teesri... / 1st, 2nd, 3rd...).
 */

export const HINDI_ORDINALS: Record<number, string> = {
  1: "Pehli (1st)",
  2: "Dusri (2nd)",
  3: "Teesri (3rd)",
  4: "Chauthi (4th)",
  5: "Paanchvi (5th)",
  6: "Chhatthi (6th)",
  7: "Saatvi (7th)",
  8: "Aathvi (8th)",
  9: "Nauvi (9th)",
  10: "Dasvi (10th)",
  11: "Gyarahvi (11th)",
  12: "Barahvi (12th)",
  13: "Terahvi (13th)",
  14: "Chaudahvi (14th)",
  15: "Pandrahvi (15th)",
  16: "Solahvi (16th)",
  17: "Satrahvi (17th)",
  18: "Atharahvi (18th)",
  19: "Unnisvi (19th)",
  20: "Beesvi (20th)",
  21: "Ikkisvi (21st)",
  22: "Baeesvi (22nd)",
  23: "Teisvi (23rd)",
  24: "Chaubisvi (24th)",
  25: "Pachchisvi (25th)",
  26: "Chhabbisvi (26th)",
  27: "Sattaisvi (27th)",
  28: "Athhaisvi (28th)",
  29: "Unatisvi (29th)",
  30: "Teesvi (30th)",
  36: "Chhattisvi (36th)",
  48: "Adtalisvi (48th)",
  60: "Saathvi (60th)",
};

export function getEmiOrdinal(emiNo: number): string {
  if (emiNo in HINDI_ORDINALS) {
    return HINDI_ORDINALS[emiNo];
  }
  const rem10 = emiNo % 10;
  const rem100 = emiNo % 100;
  let suffix = "th";
  if (rem10 === 1 && rem100 !== 11) suffix = "st";
  else if (rem10 === 2 && rem100 !== 12) suffix = "nd";
  else if (rem10 === 3 && rem100 !== 13) suffix = "rd";
  return `${emiNo}${suffix}`;
}

/**
 * Format an array of EMI numbers into a friendly human-readable label.
 * E.g. [1] -> "EMI #1 · Pehli (1st)"
 *      [2] -> "EMI #2 · Dusri (2nd)"
 *      [1, 2] -> "EMI #1, #2 (Pehli, Dusri)"
 */
export function formatEmiNumbers(numbers?: number[] | null): string {
  if (!numbers || numbers.length === 0) return "—";
  const unique = Array.from(new Set(numbers.filter((n) => typeof n === "number" && n > 0))).sort(
    (a, b) => a - b
  );
  if (unique.length === 0) return "—";

  if (unique.length === 1) {
    const num = unique[0];
    return `EMI #${num} · ${getEmiOrdinal(num)}`;
  }

  const numPart = unique.map((n) => `#${n}`).join(", ");
  const ordinals = unique.map((n) => getEmiOrdinal(n).split(" ")[0]).join(", ");
  return `EMI ${numPart} (${ordinals})`;
}
