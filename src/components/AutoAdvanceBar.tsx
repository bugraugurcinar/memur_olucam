export type AutoAdvanceBarProps = {
  remainingMs: number;
  durationMs: number;
  variant: "correct" | "wrong";
};

export function AutoAdvanceBar({ remainingMs, durationMs, variant }: AutoAdvanceBarProps) {
  const pct = Math.max(0, Math.min(100, (remainingMs / durationMs) * 100));
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  return (
    <div
      className={`auto-advance-bar auto-advance-bar--${variant}`}
      role="status"
      aria-label={`${remainingSeconds} sn içinde sonraki soru`}
    >
      <div className="auto-advance-bar__track">
        <div className="auto-advance-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <span>Sonraki soru: {remainingSeconds}sn</span>
    </div>
  );
}
