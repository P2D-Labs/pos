import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { getVisiblePages } from "../../lib/pagination";
import { CustomSelect } from "./CustomSelect";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** Row range label e.g. "1–20" */
  rangeLabel?: string;
  maxPageButtons?: number;
};

export function PaginationBar({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  rangeLabel,
  maxPageButtons = 5,
}: Props) {
  const tp = Math.max(1, totalPages);
  const p = Math.min(Math.max(1, page), tp);
  const visible = getVisiblePages(p, tp, maxPageButtons);

  return (
    <div className="pagination-bar">
      <div className="pagination-bar__left">
        {onPageSizeChange && pageSize !== undefined ? (
          <label className="pagination-bar__page-size">
            <span className="sr-only">Rows per page</span>
            <CustomSelect
              value={String(pageSize)}
              placeholder="Rows"
              options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
              onChange={(next) => onPageSizeChange(Number(next))}
            />
            <span className="pagination-bar__page-size-label" aria-hidden>
              / page
            </span>
          </label>
        ) : null}
        {rangeLabel ? <span className="pagination-bar__range">{rangeLabel}</span> : null}
      </div>
      <div className="pagination-bar__controls">
        <button
          type="button"
          className="btn-icon"
          aria-label="First page"
          disabled={p <= 1}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft size={18} />
        </button>
        <button
          type="button"
          className="btn-icon"
          aria-label="Previous page"
          disabled={p <= 1}
          onClick={() => onPageChange(p - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        {visible.map((item, i) =>
          item === "ellipsis" ? (
            <span key={`e-${i}`} className="pagination-bar__ellipsis">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`btn-page${item === p ? " is-active" : ""}`}
              aria-label={`Page ${item}`}
              aria-current={item === p ? "page" : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className="btn-icon"
          aria-label="Next page"
          disabled={p >= tp}
          onClick={() => onPageChange(p + 1)}
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          className="btn-icon"
          aria-label="Last page"
          disabled={p >= tp}
          onClick={() => onPageChange(tp)}
        >
          <ChevronsRight size={18} />
        </button>
      </div>
    </div>
  );
}
