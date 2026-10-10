/**
 * Small, dependency-free colour helpers used to derive a full brand palette
 * from a single primary colour chosen in the Developer Console. The generated
 * scale mirrors Tailwind's 50–950 convention so the app's existing
 * `emerald-*` utility classes can be re-pointed at runtime.
 */

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(value: string): boolean {
  return HEX_RE.test((value ?? "").trim());
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function expand(hex: string): string {
  const v = hex.replace("#", "").trim();
  if (v.length === 3) {
    return v
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return v;
}

function toRgb(hex: string): [number, number, number] {
  const v = expand(hex);
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function toHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((c) => clamp(c).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Mix two RGB colours. `t` is the weight of `b` (0 → a, 1 → b). */
function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

export const DEFAULT_PRIMARY = "#059669"; // Tailwind emerald-600

export type BrandScale = Record<
  "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | "950",
  string
>;

/**
 * Derive a full 50–950 palette from a single primary colour. The input becomes
 * the 600 shade (which the UI uses for its main buttons/accents); lighter and
 * darker shades are mixed with white/black respectively.
 */
export function buildBrandScale(primary: string): BrandScale {
  const base = isValidHex(primary) ? toRgb(primary) : toRgb(DEFAULT_PRIMARY);
  return {
    50: toHex(mix(base, WHITE, 0.95)),
    100: toHex(mix(base, WHITE, 0.9)),
    200: toHex(mix(base, WHITE, 0.78)),
    300: toHex(mix(base, WHITE, 0.6)),
    400: toHex(mix(base, WHITE, 0.35)),
    500: toHex(mix(base, WHITE, 0.15)),
    600: toHex(base),
    700: toHex(mix(base, BLACK, 0.15)),
    800: toHex(mix(base, BLACK, 0.3)),
    900: toHex(mix(base, BLACK, 0.45)),
    950: toHex(mix(base, BLACK, 0.65)),
  };
}

/** CSS custom properties for the brand scale, ready to inline on <html>. */
export function brandStyleVars(primary: string): Record<string, string> {
  const scale = buildBrandScale(primary);
  const vars: Record<string, string> = {};
  (Object.keys(scale) as (keyof BrandScale)[]).forEach((key) => {
    vars[`--brand-${key}`] = scale[key];
  });
  return vars;
}
