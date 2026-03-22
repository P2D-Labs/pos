import type { LucideIcon } from "lucide-react";

export type StatTone = "blue" | "green" | "purple" | "orange" | "teal";

export function StatCards({
  items,
}: {
  items: Array<{ label: string; value: string | number; icon: LucideIcon; tone: StatTone; hint?: string }>;
}) {
  return (
    <div className="stat-cards">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className={`stat-card stat-card--${item.tone}`}>
            <div className="stat-card__top">
              <span className="stat-card__icon" aria-hidden>
                <Icon size={22} strokeWidth={2} />
              </span>
              <div className="stat-card__meta">
                <span className="stat-card__label">{item.label}</span>
                <strong className="stat-card__value">{item.value}</strong>
                {item.hint ? <span className="stat-card__hint">{item.hint}</span> : null}
              </div>
            </div>
            <div className="stat-card__bar" aria-hidden />
          </div>
        );
      })}
    </div>
  );
}
