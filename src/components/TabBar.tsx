import type { ReactNode } from "react";

export type AppTab = "harita" | "soru" | "test" | "profil";

type TabDef = {
  id: AppTab;
  label: string;
  icon: ReactNode;
};

const TABS: TabDef[] = [
  {
    id: "harita",
    label: "Harita",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
        <path d="M9 4v14M15 6v14" />
      </svg>
    ),
  },
  {
    id: "soru",
    label: "Soru+",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.3a2.6 2.6 0 0 1 5.1.7c0 1.7-2.6 2.1-2.6 3.5" />
        <path d="M12 16.8h.01" />
      </svg>
    ),
  },
  {
    id: "test",
    label: "Test",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
        <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
      </svg>
    ),
  },
  {
    id: "profil",
    label: "Profil",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8.2" r="3.7" />
        <path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" />
      </svg>
    ),
  },
];

export type TabBarProps = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
};

/** Alt gezinme çubuğu: Harita / Soru+ / Test / Profil. Sunum bileşeni. */
export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tab-bar" aria-label="Ana gezinme">
      {TABS.map((tab) => (
        <button
          aria-current={active === tab.id ? "page" : undefined}
          className={`tab-bar__item${active === tab.id ? " is-active" : ""}`}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          <span className="tab-bar__icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span className="tab-bar__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
