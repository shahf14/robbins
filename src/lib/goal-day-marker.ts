/** Infer commitment day marker from milestone title (word-boundary match). */
export function inferDayMarkerFromTitle(title: string): number | null {
  if (/\b90\b/.test(title)) return 90;
  if (/\b60\b/.test(title)) return 60;
  if (/\b30\b/.test(title)) return 30;
  return null;
}
