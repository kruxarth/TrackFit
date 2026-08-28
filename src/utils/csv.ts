export function escapeField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    const escaped = field.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return field;
}

export function toCsvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map((f) => escapeField(f === null || f === undefined ? "" : String(f))).join(",");
}

export function buildCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [toCsvRow(header), ...rows.map((r) => toCsvRow(r))];
  return lines.join("\n") + "\n";
}
