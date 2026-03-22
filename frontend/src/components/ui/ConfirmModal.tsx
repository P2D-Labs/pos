import { AlertTriangle } from "lucide-react";
import { X } from "lucide-react";
import { useEffect } from "react";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
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
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-card__header">
          {danger ? <AlertTriangle className="modal-card__warn-icon" aria-hidden /> : null}
          <h2 id="confirm-modal-title">{title}</h2>
          <button type="button" className="modal-card__close" aria-label="Close modal" disabled={loading} onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p className="modal-card__body">{message}</p>
        <div className="modal-card__actions">
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={danger ? "btn btn-danger" : "btn btn-primary"} disabled={loading} onClick={onConfirm}>
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
