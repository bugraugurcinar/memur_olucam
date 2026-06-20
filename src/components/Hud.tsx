import { useEffect, useRef, useState, type ReactNode } from "react";
import { LevelRing } from "./LevelRing";

export type HudProps = {
  loading: boolean;
  isLoggedIn: boolean;
  displayName: string;
  email?: string | null;
  level: number;
  levelProgress: number;
  intoLevel: number;
  span: number;
  totalXp: number;
  streak: number;
  sessionCorrect: number;
  sessionAnswered: number;
  onSignOut: () => void;
  canReset: boolean;
  onReset: () => void;
  accountForm: ReactNode;
};

/** Üstte yüzen HUD şeridi: marka + seviye/XP/seri + hesap menüsü. Sunum bileşeni. */
export function Hud({
  loading,
  isLoggedIn,
  displayName,
  email,
  level,
  levelProgress,
  intoLevel,
  span,
  totalXp,
  streak,
  sessionCorrect,
  sessionAnswered,
  onSignOut,
  canReset,
  onReset,
  accountForm,
}: HudProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!accountOpen) {
      return;
    }
    const handlePointer = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [accountOpen]);

  const remainingXp = Math.max(0, span - intoLevel);
  const streakDots = Array.from({ length: 7 }, (_, index) => index < Math.min(streak, 7));

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
          <small>İnteraktif KPSS coğrafya</small>
        </div>
      </div>

      {isLoggedIn ? (
        <div className="hud__stats">
          <LevelRing level={level} progress={levelProgress} />
          <div className="hud__xp">
            <div className="hud__xp-head">
              <span>Seviye {level}</span>
              <small>{remainingXp} XP → Sv {level + 1}</small>
            </div>
            <div className="xp-bar">
              <div className="xp-bar__fill" style={{ width: `${Math.round(levelProgress * 100)}%` }} />
            </div>
          </div>
          <div className="hud__chip hud__chip--streak" title={`${streak} günlük seri`}>
            <span aria-hidden="true">🔥</span>
            <div className="hud__streak-dots" aria-hidden="true">
              {streakDots.map((on, index) => (
                <i className={on ? "is-on" : ""} key={index} />
              ))}
            </div>
            <strong>{streak}</strong>
          </div>
          <div className="hud__chip" title="Toplam XP">
            <span aria-hidden="true">⭐</span>
            <strong>{totalXp}</strong>
            <small>XP</small>
          </div>
        </div>
      ) : (
        <div className="hud__stats hud__stats--guest">
          <p>Giriş yap; XP kazan, rozet topla, liderlik tablosuna gir.</p>
        </div>
      )}

      <div className="hud__account" ref={popoverRef}>
        <button
          className="hud__account-button"
          onClick={() => setAccountOpen((value) => !value)}
          aria-expanded={accountOpen}
          type="button"
        >
          {isLoggedIn ? (
            <>
              <span className="hud__avatar" aria-hidden="true">
                {displayName.slice(0, 1).toLocaleUpperCase("tr-TR")}
              </span>
              <span className="hud__account-name">{displayName}</span>
            </>
          ) : (
            <span className="hud__account-cta">{loading ? "Yükleniyor…" : "Giriş yap"}</span>
          )}
        </button>

        {accountOpen ? (
          <div className="hud__popover glass" role="dialog" aria-label="Hesap">
            {isLoggedIn ? (
              <div className="account-menu">
                <div className="account-menu__id">
                  <strong>{displayName}</strong>
                  {email ? <small>{email}</small> : null}
                </div>
                <div className="account-menu__session">
                  {sessionAnswered > 0
                    ? `Bu oturum: ${sessionCorrect}/${sessionAnswered} doğru`
                    : "Bu oturumda henüz soru çözmedin."}
                </div>
                <div className="account-menu__actions">
                  {canReset ? (
                    <button className="ghost-button" onClick={onReset} type="button">
                      İlerlemeyi sıfırla
                    </button>
                  ) : null}
                  <button
                    className="ghost-button"
                    onClick={() => {
                      onSignOut();
                      setAccountOpen(false);
                    }}
                    type="button"
                  >
                    Çıkış yap
                  </button>
                </div>
              </div>
            ) : (
              accountForm
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
