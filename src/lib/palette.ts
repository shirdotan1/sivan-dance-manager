/**
 * Fixed palette for groups and projects (calendar colors).
 *
 * Every color is a mid-tone with ≥3:1 contrast against white, ivory and
 * the dark-theme surfaces (checked when chosen), so dots and bars stay
 * visible in both themes. Ordered so the first colors assigned are the
 * most distinct. Color is never the only cue: names always accompany it.
 */
export const PALETTE = [
  "#3b6fc4", // כחול
  "#c8621b", // כתום
  "#2f8a4f", // ירוק
  "#c4407a", // ורוד
  "#8b4fc4", // סגול
  "#9a7a0c", // חרדל
  "#11858f", // טורקיז
  "#c43d3d", // אדום
  "#6a7d2a", // זית
  "#5a5fd6", // אינדיגו
] as const;

/** Neutral color for lessons without a group. */
export const NEUTRAL_COLOR = "#8a7884";

/** Picks the least-used palette color (first in order on ties). */
export function pickColor(usedColors: readonly string[]): string {
  const counts = new Map<string, number>(PALETTE.map((c) => [c, 0]));
  for (const c of usedColors) {
    const key = c.toLowerCase();
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  let best: string = PALETTE[0];
  for (const c of PALETTE) if (counts.get(c)! < counts.get(best)!) best = c;
  return best;
}
