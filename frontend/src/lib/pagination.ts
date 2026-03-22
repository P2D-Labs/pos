/** Page numbers with ellipsis for a bounded window (max visible numeric buttons). */
export function getVisiblePages(current: number, total: number, maxVisible = 5): (number | "ellipsis")[] {
  if (total < 1) return [1];
  const t = Math.max(1, total);
  const c = Math.min(Math.max(1, current), t);
  if (t <= maxVisible) {
    return Array.from({ length: t }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(t);
  const innerSlots = maxVisible - 2;
  let start = Math.max(2, c - Math.floor(innerSlots / 2));
  let end = Math.min(t - 1, start + innerSlots - 1);
  start = Math.max(2, end - innerSlots + 1);
  for (let p = start; p <= end; p++) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

/** When API does not return total count: infer total pages from full/partial last page. */
export function inferTotalPages(page: number, pageSize: number, rowCount: number): number {
  if (rowCount === 0) return Math.max(1, page - 1);
  return rowCount < pageSize ? page : page + 1;
}
