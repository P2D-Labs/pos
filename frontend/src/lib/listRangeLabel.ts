export function listRangeLabel(page: number, pageSize: number, rowCount: number): string {
  if (rowCount === 0) return "No rows on this page";
  const start = (page - 1) * pageSize + 1;
  const end = start + rowCount - 1;
  return `Showing ${start}–${end}`;
}
