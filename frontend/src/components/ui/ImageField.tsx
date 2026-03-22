import { Expand, ImagePlus, Link2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function isValidImageFile(file: File) {
  return file.type.startsWith("image/");
}

export function ImageField({
  label,
  value,
  onChange,
  hint = "Accepted: image/*, recommended <= 2MB",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    if (!viewerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setViewerOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [viewerOpen]);

  function applyFile(file: File) {
    if (!isValidImageFile(file)) {
      setError("Please select a valid image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image is too large. Please use a file up to 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const next = String(reader.result ?? "");
      if (!next) {
        setError("Failed to read image.");
        return;
      }
      setError("");
      onChange(next);
    };
    reader.onerror = () => setError("Failed to read image.");
    reader.readAsDataURL(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) applyFile(file);
  }

  return (
    <div className="stack">
      <label>{label}</label>
      <div className="inline-form">
        <div className="image-url-field">
          <Link2 size={16} />
          <input
            placeholder={`${label} URL`}
            value={value}
            style={{ paddingLeft: 52 }}
            onChange={(e) => {
              setError("");
              onChange(e.target.value);
            }}
          />
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
          <Upload size={16} />
          Select image
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) applyFile(file);
        }}
      />
      <div
        className="panel panel--pad"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        style={{ borderStyle: "dashed" }}
      >
        <p className="page-desc">
          <ImagePlus size={14} className="icon-title" />
          Drag and drop image here, or use Select image.
        </p>
        <p className="page-desc">{hint}</p>
      </div>
      {value ? (
        <div className="panel panel--pad">
          <div className="inline-form">
            <img src={value} alt={label} style={{ maxWidth: 180, maxHeight: 120, borderRadius: 6, border: "1px solid var(--border)" }} />
            <button type="button" className="btn btn-secondary" onClick={() => setViewerOpen(true)}>
              <Expand size={14} />
              Full screen
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="alert alert-error">{error}</p> : null}

      {viewerOpen ? (
        <div className="modal-backdrop" onClick={() => setViewerOpen(false)}>
          <div className="modal-card modal-card--scrollable" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <h2>{label}</h2>
              <button type="button" className="modal-card__close" aria-label="Close image viewer" onClick={() => setViewerOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-card__content">
              <img src={value} alt={label} style={{ width: "100%", borderRadius: 8 }} />
            </div>
            <div className="modal-card__actions">
              <button type="button" className="btn btn-secondary" onClick={() => setViewerOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
