import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SelectOption = { value: string; label: string };

export function CustomSelect({
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
  searchable = false,
  className = "",
  searchPlaceholder = "Search…",
}: {
  value: string;
  options: SelectOption[];
  placeholder: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Type to filter options (large lists). */
  searchable?: boolean;
  /** Extra class on root (e.g. `custom-select--till`). */
  className?: string;
  searchPlaceholder?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const filteredOptions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, filter]);

  const selectedLabel = useMemo(
    () => options.find((opt) => opt.value === value)?.label ?? placeholder,
    [options, value, placeholder],
  );

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    function updateMenuPosition() {
      const trigger = rootRef.current?.querySelector(".custom-select__trigger") as HTMLElement | null;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 8;
      const top = rect.bottom + 4;
      const maxHeight = Math.max(120, window.innerHeight - top - viewportPadding);
      setMenuStyle({
        top,
        left: rect.left,
        width: rect.width,
        maxHeight,
      });
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (open && searchable) {
      setFilter("");
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  const menu = open && menuStyle ? (
    <div
      ref={menuRef}
      className="custom-select__menu"
      style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width, maxHeight: menuStyle.maxHeight }}
      onWheel={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
    >
      {searchable ? (
        <div className="custom-select__search">
          <input
            ref={searchRef}
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="custom-select__search-input input-control"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
      <button
        type="button"
        className={`custom-select__option${value === "" ? " is-active" : ""}`}
        onClick={() => {
          onChange("");
          setOpen(false);
        }}
      >
        {placeholder}
      </button>
      {filteredOptions.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`custom-select__option${value === opt.value ? " is-active" : ""}`}
          onClick={() => {
            onChange(opt.value);
            setOpen(false);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={`custom-select${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="custom-select__trigger"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={`custom-select__label${value ? "" : " is-placeholder"}`}>{selectedLabel}</span>
        <ChevronDown size={16} />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
