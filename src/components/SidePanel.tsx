import type { ReactNode } from "react";

export type SidePanelTab = {
  id: string;
  label: string;
  icon: string;
  content: ReactNode;
};

/** Sağ kenarda sekme rayı + açılır çekmece (İlerleme / Sıralama). Sunum bileşeni. */
export function SidePanel({
  tabs,
  activeId,
  onChange,
}: {
  tabs: SidePanelTab[];
  activeId: string | null;
  onChange: (id: string | null) => void;
}) {
  const active = tabs.find((tab) => tab.id === activeId) ?? null;

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={`side-rail${active ? " side-rail--open" : ""}`}>
      {active ? (
        <section className="side-rail__drawer glass" aria-label={active.label}>
          <div className="side-rail__head">
            <h2>{active.label}</h2>
            <button
              className="icon-button"
              onClick={() => onChange(null)}
              type="button"
              aria-label="Paneli kapat"
            >
              ✕
            </button>
          </div>
          <div className="side-rail__body">{active.content}</div>
        </section>
      ) : null}

      <nav className="side-rail__tabs glass" aria-label="Yan paneller">
        {tabs.map((tab) => (
          <button
            className={`side-rail__tab${tab.id === activeId ? " side-rail__tab--active" : ""}`}
            key={tab.id}
            onClick={() => onChange(tab.id === activeId ? null : tab.id)}
            aria-pressed={tab.id === activeId}
            title={tab.label}
            type="button"
          >
            <span aria-hidden="true">{tab.icon}</span>
            <small>{tab.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
