export function splitCommaList(value: string): string[] {
  return value
    .split(/[,،\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinCommaList(items: string[]): string {
  return items.join(', ');
}
