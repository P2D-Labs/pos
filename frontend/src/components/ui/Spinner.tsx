import { Loader2 } from "lucide-react";
import clsx from "clsx";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={clsx("ui-spinner", className)} role="status" aria-label={label ?? "Loading"}>
      <Loader2 className="ui-spinner__icon" aria-hidden />
    </span>
  );
}

export function SpinnerBlock({ label }: { label?: string }) {
  return (
    <div className="ui-spinner-block">
      <Spinner label={label} />
    </div>
  );
}
