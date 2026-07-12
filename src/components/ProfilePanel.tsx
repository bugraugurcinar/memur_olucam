import { AccountForm } from "./AccountForm";
import { LevelRing } from "./LevelRing";
import type { UseAuthResult } from "../hooks/useAuth";
import type { UseQuizProgressResult } from "../hooks/useQuizProgress";
import type { UseLeaderboardResult } from "../hooks/useLeaderboard";
import { accuracyPercent, BADGES, type Badge, type PlusTopicId, type TopicStat } from "../quiz/gamification";

export type WeakTopicRow = {
  id: PlusTopicId;
  label: string;
  stat: TopicStat;
};

export type ProfilePanelProps = {
  auth: UseAuthResult;
  displayName: string;
  progress: UseQuizProgressResult;
  leaderboard: UseLeaderboardResult;
  weakTopicRows: WeakTopicRow[];
  nextBadge: Badge | null;
  examDaysLeft: number | null;
  dailyXp: number;
  dailyXpGoal: number;
  onRefreshLeaderboard: () => void;
  onResetProgress: () => void;
  onWeakTopicPractice: (topic: PlusTopicId) => void;
  onSetExamDate: () => void;
  onSignOut: () => void;
};

/** Profil sekmesi: hesap, seviye/XP özeti, sıralama, performans, günlük görevler, rozetler. */
export function ProfilePanel({
  auth,
  displayName,
  progress,
  leaderboard,
  weakTopicRows,
  nextBadge,
  examDaysLeft,
  dailyXp,
  dailyXpGoal,
  onRefreshLeaderboard,
  onResetProgress,
  onWeakTopicPractice,
  onSetExamDate,
  onSignOut,
}: ProfilePanelProps) {
  const isLoggedIn = Boolean(auth.user);
  const remainingXp = Math.max(0, progress.level.span - progress.level.intoLevel);
  const canReset = isLoggedIn && progress.totals.answered > 0;

  return (
    <div className="profile-stage">
      <div className="profile-stage__inner">
        <div className="panel-section profile-account">
          <div className="quiz-section-heading">
            <h2>Hesap</h2>
            {isLoggedIn ? (
              <button className="account-form__toggle" onClick={onSignOut} type="button">
                Çıkış yap
              </button>
            ) : null}
          </div>

          {isLoggedIn ? (
            <>
              <div className="profile-identity">
                <span className="profile-identity__avatar" aria-hidden="true">
                  {displayName.slice(0, 1).toLocaleUpperCase("tr-TR")}
                </span>
                <div className="profile-identity__body">
                  <strong>{displayName}</strong>
                  {auth.user?.email ? <small>{auth.user.email}</small> : null}
                </div>
                <LevelRing level={progress.level.level} progress={progress.level.progress} />
              </div>

              <div className="profile-stat-grid">
                <div className="progress-stat">
                  <strong>{progress.xp}</strong>
                  <small>Toplam XP</small>
                </div>
                <div className="progress-stat">
                  <strong>{remainingXp}</strong>
                  <small>XP → Sv {progress.level.level + 1}</small>
                </div>
                <div className="progress-stat">
                  <strong>🔥 {progress.daily.dailyStreak}</strong>
                  <small>Günlük seri</small>
                </div>
                <div className="progress-stat">
                  <strong>
                    {dailyXp}/{dailyXpGoal}
                  </strong>
                  <small>Bugünkü XP</small>
                </div>
              </div>

              {progress.session.answered > 0 ? (
                <p className="profile-session-note">
                  Bu oturum: {progress.session.correct}/{progress.session.answered} doğru
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="progress-empty">Giriş yap; XP kazan, rozet topla ve liderlik tablosuna gir. 🚀</p>
              <AccountForm auth={auth} />
            </>
          )}

          <button className="profile-exam-row" onClick={onSetExamDate} type="button">
            <span aria-hidden="true">🗓️</span>
            {examDaysLeft !== null ? (
              <>
                <strong>{examDaysLeft} gün</strong>
                <small>KPSS&apos;ye kalan · dokunarak değiştir</small>
              </>
            ) : (
              <small>Sınav tarihi ekle</small>
            )}
          </button>
        </div>

        {isLoggedIn ? (
          <div className="panel-section dock-leaderboard">
            <div className="quiz-section-heading">
              <h2>Sıralama</h2>
              <button className="account-form__toggle" onClick={onRefreshLeaderboard} type="button">
                Yenile
              </button>
            </div>
            {leaderboard.error ? (
              <p className="progress-error">{leaderboard.error}</p>
            ) : leaderboard.isLoading ? (
              <p className="progress-empty">Yükleniyor…</p>
            ) : leaderboard.entries.length === 0 ? (
              <p className="progress-empty">Henüz veri yok</p>
            ) : (
              <div className="leaderboard leaderboard--mini">
                {leaderboard.entries.slice(0, 5).map((entry) => (
                  <div className={`leaderboard-row${entry.isMe ? " leaderboard-row--me" : ""}`} key={entry.id}>
                    <span className="leaderboard-row__rank">{entry.rank}</span>
                    <span className="leaderboard-row__name">{entry.username}</span>
                    <small>{entry.xp} XP</small>
                  </div>
                ))}
                {leaderboard.myRank && !leaderboard.entries.slice(0, 5).some((entry) => entry.isMe) ? (
                  <>
                    <div className="leaderboard__divider" aria-hidden="true" />
                    <div className="leaderboard-row leaderboard-row--me">
                      <span className="leaderboard-row__rank">{leaderboard.myRank}</span>
                      <span className="leaderboard-row__name">{displayName}</span>
                      <small>{progress.xp} XP</small>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="panel-section progress-panel dock-progress">
          <div className="quiz-section-heading">
            <h2>Performans</h2>
            {canReset ? (
              <button className="account-form__toggle" onClick={onResetProgress} type="button">
                Sıfırla
              </button>
            ) : null}
          </div>
          {progress.error ? <p className="progress-error">{progress.error}</p> : null}
          {progress.isLoading ? (
            <p className="progress-empty">Yükleniyor…</p>
          ) : progress.totals.answered === 0 ? (
            <p className="progress-empty">Henüz veri yok</p>
          ) : (
            <>
              <div className="progress-summary">
                <div className="progress-stat">
                  <strong>{progress.totals.answered}</strong>
                  <small>Soru</small>
                </div>
                <div className="progress-stat">
                  <strong>%{accuracyPercent(progress.totals.correct, progress.totals.answered)}</strong>
                  <small>Doğruluk</small>
                </div>
                <div className="progress-stat">
                  <strong>{progress.totals.bestStreak}</strong>
                  <small>En iyi seri</small>
                </div>
              </div>
              <div className="progress-topic-list">
                {weakTopicRows.slice(0, 3).map((row) => {
                  const accuracy = accuracyPercent(row.stat.correct, row.stat.answered);
                  return (
                    <button
                      className="progress-topic-row progress-topic-row--practice"
                      key={row.id}
                      onClick={() => onWeakTopicPractice(row.id)}
                      type="button"
                    >
                      <span className="progress-topic-row__label">{row.label}</span>
                      <div className="progress-bar">
                        <div className="progress-bar__fill" style={{ width: `${accuracy}%` }} />
                      </div>
                      <small>
                        {row.stat.correct}/{row.stat.answered}
                      </small>
                      <span className="progress-topic-row__cta" aria-hidden="true">
                        ▶
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {isLoggedIn ? (
          <>
            <div className="panel-section daily-panel">
              <div className="quiz-section-heading">
                <h2>Günlük görevler</h2>
                <span className="daily-streak">🔥 {progress.daily.dailyStreak} gün</span>
              </div>
              <div className="daily-quest-list">
                {progress.daily.quests.map((quest) => {
                  const percent = Math.round((quest.progress / quest.target) * 100);
                  return (
                    <div className={`daily-quest${quest.done ? " daily-quest--done" : ""}`} key={quest.id}>
                      <div className="daily-quest__head">
                        <span>
                          {quest.done ? "✅ " : ""}
                          {quest.label}
                        </span>
                        <small>
                          {quest.progress}/{quest.target} · +{quest.xpReward}
                        </small>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel-section badge-panel">
              <div className="quiz-section-heading">
                <h2>Rozetler</h2>
                <span>
                  {progress.badges.length}/{BADGES.length}
                </span>
              </div>
              {nextBadge ? (
                <div className="next-badge">
                  <span className="next-badge__icon">{nextBadge.icon}</span>
                  <div className="next-badge__body">
                    <strong>Sıradaki rozet · {nextBadge.label}</strong>
                    <small>{nextBadge.description}</small>
                  </div>
                </div>
              ) : (
                <div className="next-badge next-badge--done">
                  <span className="next-badge__icon">🏆</span>
                  <div className="next-badge__body">
                    <strong>Tüm rozetler açıldı!</strong>
                    <small>Hepsini topladın, tebrikler.</small>
                  </div>
                </div>
              )}
              {progress.badges.length > 0 ? (
                <div className="badge-grid">
                  {BADGES.filter((badge) => progress.badges.includes(badge.id)).map((badge) => (
                    <div className="badge" key={badge.id}>
                      <span className="badge__icon">{badge.icon}</span>
                      <small>{badge.label}</small>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
