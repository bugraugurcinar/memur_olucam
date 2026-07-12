import { LevelRing } from "./LevelRing";

export type HudProps = {
  isLoggedIn: boolean;
  level: number;
  levelProgress: number;
  streak: number;
  dailyXp: number;
  dailyXpGoal: number;
};

/** Üstteki ince durum şeridi: marka + seviye/seri/günlük hedef. Detaylar Profil sekmesinde. */
export function Hud({ isLoggedIn, level, levelProgress, streak, dailyXp, dailyXpGoal }: HudProps) {
  const dailyGoalReached = dailyXpGoal > 0 && dailyXp >= dailyXpGoal;
  const dailyGoalPercent = dailyXpGoal > 0 ? Math.min(100, Math.round((dailyXp / dailyXpGoal) * 100)) : 0;

  return (
    <header className="hud glass">
      <div className="hud__brand">
        <span className="hud__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C7.6 2 4 5.5 4 9.8c0 5.2 6.6 11.4 7.4 12.1.34.3.86.3 1.2 0C13.4 21.2 20 15 20 9.8 20 5.5 16.4 2 12 2Z"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <circle cx="12" cy="9.8" r="2.6" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        </span>
        <div className="hud__title">
          <strong>Coğrafya Atlas</strong>
        </div>
      </div>

      {isLoggedIn ? (
        <div className="hud__stats">
          <LevelRing level={level} progress={levelProgress} size={32} stroke={3} />
          <div className="hud__chip hud__chip--streak">
            <span aria-hidden="true">🔥</span>
            <strong>{streak}</strong>
          </div>
          <div className={`hud__chip hud__chip--goal${dailyGoalReached ? " is-reached" : ""}`}>
            <span aria-hidden="true">{dailyGoalReached ? "✅" : "🎯"}</span>
            <div className="hud__goal-track" aria-hidden="true">
              <div className="hud__goal-fill" style={{ width: `${dailyGoalPercent}%` }} />
            </div>
            <strong>{dailyXp}</strong>
          </div>
        </div>
      ) : null}
    </header>
  );
}
