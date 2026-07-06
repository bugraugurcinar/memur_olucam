import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  applyAnswerToQuests,
  computeXpGain,
  emptyDaily,
  emptyTotals,
  evaluateEarnedBadges,
  formatDateKey,
  levelFromXp,
  QUIZ_TOPIC_IDS,
  registerActiveDay,
  rolloverDaily,
  type DailyState,
  type GamificationEvents,
  type LevelInfo,
  type ProgressTotals,
  type QuizTopicId,
  type SessionStats,
} from "../quiz/gamification";

export type UseQuizProgressResult = {
  totals: ProgressTotals;
  session: SessionStats;
  xp: number;
  level: LevelInfo;
  badges: string[];
  daily: DailyState;
  isLoading: boolean;
  error: string | null;
  recordAnswer: (input: { topic: QuizTopicId; isCorrect: boolean }) => GamificationEvents;
  reset: () => Promise<void>;
};

type ProgressRow = {
  answered?: number | null;
  correct?: number | null;
  best_streak?: number | null;
  by_topic?: unknown;
  badges?: unknown;
  daily?: unknown;
};

const EMPTY_SESSION: SessionStats = { answered: 0, correct: 0, currentStreak: 0 };
const NO_EVENTS: GamificationEvents = {
  xpGained: 0,
  leveledUp: null,
  unlockedBadges: [],
  completedQuests: [],
};

function mapTotals(row: ProgressRow | null): ProgressTotals {
  const totals = emptyTotals();
  if (!row) {
    return totals;
  }
  totals.answered = typeof row.answered === "number" ? row.answered : 0;
  totals.correct = typeof row.correct === "number" ? row.correct : 0;
  totals.bestStreak = typeof row.best_streak === "number" ? row.best_streak : 0;

  if (row.by_topic && typeof row.by_topic === "object") {
    const source = row.by_topic as Record<string, unknown>;
    for (const id of QUIZ_TOPIC_IDS) {
      const stat = source[id];
      if (stat && typeof stat === "object") {
        const typed = stat as { answered?: unknown; correct?: unknown };
        totals.byTopic[id] = {
          answered: typeof typed.answered === "number" ? typed.answered : 0,
          correct: typeof typed.correct === "number" ? typed.correct : 0,
        };
      }
    }
  }
  return totals;
}

function mapBadges(row: ProgressRow | null): string[] {
  if (row && Array.isArray(row.badges)) {
    return row.badges.filter((badge): badge is string => typeof badge === "string");
  }
  return [];
}

function mapDaily(row: ProgressRow | null): DailyState | null {
  if (row && row.daily && typeof row.daily === "object" && "dateKey" in (row.daily as object)) {
    return row.daily as DailyState;
  }
  return null;
}

export function useQuizProgress(user: User | null): UseQuizProgressResult {
  const userId = user?.id ?? null;
  const metadataUsername = user?.user_metadata?.username;
  const profileUsername = typeof metadataUsername === "string" ? metadataUsername.trim() : "";

  const [totals, setTotals] = useState<ProgressTotals>(() => emptyTotals());
  const [session, setSession] = useState<SessionStats>(EMPTY_SESSION);
  const [xp, setXp] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [daily, setDaily] = useState<DailyState>(() => emptyDaily(formatDateKey(new Date())));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // recordAnswer içinde senkron, taze hesap için aynalar.
  const totalsRef = useRef(totals);
  const sessionRef = useRef(session);
  const xpRef = useRef(xp);
  const badgesRef = useRef(badges);
  const dailyRef = useRef(daily);

  const level = useMemo(() => levelFromXp(xp), [xp]);

  const persist = useCallback(
    async (
      uid: string,
      nextXp: number,
      nextTotals: ProgressTotals,
      nextBadges: string[],
      nextDaily: DailyState,
    ): Promise<void> => {
      if (!supabase) {
        return;
      }
      const timestamp = new Date().toISOString();
      const [profileResult, progressResult] = await Promise.all([
        // NOT: `upsert` kullanma. profiles.username NOT NULL olduğundan,
        // username içermeyen bir upsert INSERT tuple'ını kurarken NOT NULL'a
        // takılır (conflict sayılmaz, UPDATE'e düşmeden hata verir) → XP hiç
        // yazılmaz. Satır trigger/backfill ile zaten var; düz UPDATE yeterli.
        supabase.from("profiles").update({ xp: nextXp, updated_at: timestamp }).eq("id", uid),
        supabase.from("quiz_progress").upsert({
          user_id: uid,
          answered: nextTotals.answered,
          correct: nextTotals.correct,
          best_streak: nextTotals.bestStreak,
          by_topic: nextTotals.byTopic,
          badges: nextBadges,
          daily: nextDaily,
          updated_at: timestamp,
        }),
      ]);
      if (profileResult.error || progressResult.error) {
        // eslint-disable-next-line no-console
        console.error("[progress] kaydetme hatası", {
          profile: profileResult.error,
          progress: progressResult.error,
        });
        const detail = profileResult.error?.message ?? progressResult.error?.message ?? "bilinmiyor";
        setError(`Kaydedilemedi: ${detail}`);
      }
    },
    [],
  );

  useEffect(() => {
    const todayKey = formatDateKey(new Date());

    // Oturum her kullanıcı değişiminde (giriş/çıkış) sıfırlanır.
    sessionRef.current = EMPTY_SESSION;
    setSession(EMPTY_SESSION);
    setError(null);

    if (!userId || !supabase) {
      const freshTotals = emptyTotals();
      const freshDaily = rolloverDaily(null, todayKey);
      totalsRef.current = freshTotals;
      xpRef.current = 0;
      badgesRef.current = [];
      dailyRef.current = freshDaily;
      setTotals(freshTotals);
      setXp(0);
      setBadges([]);
      setDaily(freshDaily);
      setIsLoading(false);
      return;
    }

    const client = supabase;
    let ignore = false;
    setIsLoading(true);

    void (async () => {
      const [profileResult, progressResult] = await Promise.all([
        client.from("profiles").select("xp").eq("id", userId).maybeSingle(),
        client.from("quiz_progress").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      if (ignore) {
        return;
      }

      if (profileResult.error || progressResult.error) {
        // eslint-disable-next-line no-console
        console.error("[progress] yükleme hatası", {
          profile: profileResult.error,
          progress: progressResult.error,
        });
        const detail = profileResult.error?.message ?? progressResult.error?.message ?? "bilinmiyor";
        setError(`Yüklenemedi: ${detail}`);
      }

      const profileData = profileResult.data as { xp?: number | null } | null;
      const progressData = progressResult.data as ProgressRow | null;

      // Kendini onarma: profil satırı yoksa (trigger kaçtıysa) burada oluştur.
      // Aksi halde `profiles.upsert` INSERT yolunda username NOT NULL'a takılır
      // ve XP yazımları sessizce başarısız olur → yenilemede XP sıfırlanır.
      if (!profileResult.error && !profileData) {
        const username = profileUsername || `oyuncu_${userId.slice(0, 8)}`;
        const repairResult = await client
          .from("profiles")
          .upsert({ id: userId, username, xp: 0 }, { onConflict: "id", ignoreDuplicates: true });
        if (ignore) {
          return;
        }
        if (repairResult.error) {
          setError(`Profil oluşturulamadı: ${repairResult.error.message}`);
        }
      }

      const loadedXp = typeof profileData?.xp === "number" ? profileData.xp : 0;
      const loadedTotals = mapTotals(progressData);
      const loadedBadges = mapBadges(progressData);
      const loadedDaily = rolloverDaily(mapDaily(progressData), todayKey);

      totalsRef.current = loadedTotals;
      xpRef.current = loadedXp;
      badgesRef.current = loadedBadges;
      dailyRef.current = loadedDaily;
      setTotals(loadedTotals);
      setXp(loadedXp);
      setBadges(loadedBadges);
      setDaily(loadedDaily);
      setIsLoading(false);
    })();

    return () => {
      ignore = true;
    };
  }, [profileUsername, userId]);

  const recordAnswer = useCallback(
    (input: { topic: QuizTopicId; isCorrect: boolean }): GamificationEvents => {
      const todayKey = formatDateKey(new Date());

      // 1) Oturum — her zaman, bellekte.
      const prevSession = sessionRef.current;
      const streakAfter = input.isCorrect ? prevSession.currentStreak + 1 : 0;
      const nextSession: SessionStats = {
        answered: prevSession.answered + 1,
        correct: prevSession.correct + (input.isCorrect ? 1 : 0),
        currentStreak: streakAfter,
      };
      sessionRef.current = nextSession;
      setSession(nextSession);

      // Girişsiz / yapılandırmasız: yalnız oturum.
      if (!userId || !supabase) {
        return NO_EVENTS;
      }

      // 2) Lifetime + oyunlaştırma.
      const prevTotals = totalsRef.current;
      const topicStat = prevTotals.byTopic[input.topic] ?? { answered: 0, correct: 0 };
      const nextTotals: ProgressTotals = {
        answered: prevTotals.answered + 1,
        correct: prevTotals.correct + (input.isCorrect ? 1 : 0),
        bestStreak: Math.max(prevTotals.bestStreak, streakAfter),
        byTopic: {
          ...prevTotals.byTopic,
          [input.topic]: {
            answered: topicStat.answered + 1,
            correct: topicStat.correct + (input.isCorrect ? 1 : 0),
          },
        },
      };

      // Günlük: aktif gün serisi + görev ilerleme.
      const activeDaily = registerActiveDay(dailyRef.current, todayKey);
      const questResult = applyAnswerToQuests(activeDaily.quests, input);
      const nextDaily: DailyState = { ...activeDaily, quests: questResult.quests };
      const questXp = questResult.completed.reduce((sum, quest) => sum + quest.xpReward, 0);

      // XP + seviye.
      const prevXp = xpRef.current;
      const xpFromAnswer = input.isCorrect ? computeXpGain(streakAfter) : 0;
      const newXp = prevXp + xpFromAnswer + questXp;
      const fromLevel = levelFromXp(prevXp).level;
      const toLevel = levelFromXp(newXp).level;
      const leveledUp = toLevel > fromLevel ? { from: fromLevel, to: toLevel } : null;

      // Rozetler.
      const prevBadges = badgesRef.current;
      const earned = evaluateEarnedBadges({
        totals: nextTotals,
        xp: newXp,
        level: toLevel,
        dailyStreak: nextDaily.dailyStreak,
      });
      const unlockedBadges = earned.filter((id) => !prevBadges.includes(id));
      const nextBadges = unlockedBadges.length > 0 ? [...prevBadges, ...unlockedBadges] : prevBadges;

      // Optimistik state + aynalar.
      totalsRef.current = nextTotals;
      xpRef.current = newXp;
      badgesRef.current = nextBadges;
      dailyRef.current = nextDaily;
      setTotals(nextTotals);
      setXp(newXp);
      setBadges(nextBadges);
      setDaily(nextDaily);

      // Tam agrega upsert (fire-and-forget).
      void persist(userId, newXp, nextTotals, nextBadges, nextDaily);

      return {
        xpGained: xpFromAnswer + questXp,
        leveledUp,
        unlockedBadges,
        completedQuests: questResult.completed,
      };
    },
    [userId, persist],
  );

  const reset = useCallback(async (): Promise<void> => {
    const todayKey = formatDateKey(new Date());
    const freshTotals = emptyTotals();
    const freshDaily = emptyDaily(todayKey);

    totalsRef.current = freshTotals;
    xpRef.current = 0;
    badgesRef.current = [];
    dailyRef.current = freshDaily;
    sessionRef.current = EMPTY_SESSION;
    setTotals(freshTotals);
    setXp(0);
    setBadges([]);
    setDaily(freshDaily);
    setSession(EMPTY_SESSION);
    setError(null);

    if (!userId || !supabase) {
      return;
    }
    await persist(userId, 0, freshTotals, [], freshDaily);
  }, [userId, persist]);

  return { totals, session, xp, level, badges, daily, isLoading, error, recordAnswer, reset };
}
