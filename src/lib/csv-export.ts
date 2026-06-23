export function escapeCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  const needsFormulaGuard = /^[=+\-@\t\r]/.test(str);
  const guarded = needsFormulaGuard ? `'${str}` : str;

  if (guarded.includes(',') || guarded.includes('"') || guarded.includes('\n') || guarded.includes('\r')) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }

  return guarded;
}

export function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.map((column) => escapeCsvCell(column)).join(',');
  const body = rows
    .map((row) => columns.map((column) => escapeCsvCell(row[column])).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
