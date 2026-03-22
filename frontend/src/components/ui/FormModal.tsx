import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function FormModal({
  open,
  title,
  children,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  loading,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !loading && onCancel()}>
      <div
        className="modal-card modal-card--scrollable"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-card__header">
          <h2 id="form-modal-title">{title}</h2>
          <button type="button" className="modal-card__close" aria-label="Close modal" disabled={loading} onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-card__content">{children}</div>
        <div className="modal-card__actions">
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-primary" disabled={loading} onClick={onConfirm}>
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
