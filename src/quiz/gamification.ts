import { plusQuestionTopicOptions, type PlusQuestionTopic } from "./plusQuestionEngine";

/**
 * Saf oyunlaştırma mantığı: XP, seviye, rozet ve günlük görev hesapları.
 * Hiçbir yan etki yok (fetch / localStorage / Date.now). Tarih gereken yerde
 * çağıran taraf `formatDateKey(new Date())` ile bugünün anahtarını verir.
 */

export type PlusTopicId = Exclude<PlusQuestionTopic, "mixed">;

export const PLUS_TOPIC_IDS: PlusTopicId[] = plusQuestionTopicOptions
  .filter((option) => option.id !== "mixed")
  .map((option) => option.id as PlusTopicId);

export function plusTopicLabel(id: PlusTopicId): string {
  return plusQuestionTopicOptions.find((option) => option.id === id)?.label ?? id;
}

/**
 * Harita dışı "Test Soru Modu" konuları (Tarih, Vatandaşlık). Soru+ harita
 * konularına (mine, river, province...) dokunmadan, yalnız oyunlaştırma/istatistik
 * katmanında yaşarlar; bu yüzden `plusQuestionTopicOptions`'a EKLENMEZLER (harita
 * konu seçicisinde çıkmazlar).
 */
export type TestTopicId = "tarih" | "vatandaslik" | "cografya";

export const TEST_TOPIC_IDS: TestTopicId[] = ["tarih", "vatandaslik", "cografya"];

export type QuizTopicId = PlusTopicId | TestTopicId;

export const QUIZ_TOPIC_IDS: QuizTopicId[] = [...PLUS_TOPIC_IDS, ...TEST_TOPIC_IDS];

// --- Veri modeli ------------------------------------------------------------

export type TopicStat = { answered: number; correct: number };

export type ProgressTotals = {
  answered: number;
  correct: number;
  bestStreak: number;
  byTopic: Record<QuizTopicId, TopicStat>;
};

export type SessionStats = {
  answered: number;
  correct: number;
  currentStreak: number;
};

export type DailyQuest = {
  id: string;
  label: string;
  target: number;
  progress: number;
  done: boolean;
  xpReward: number;
  topic: PlusTopicId | null; // null => herhangi konu
  kind: "answer" | "correct";
};

export type DailyState = {
  dateKey: string;
  quests: DailyQuest[];
  dailyStreak: number;
  lastActiveDate: string;
};

export type GamificationEvents = {
  xpGained: number;
  leveledUp: { from: number; to: number } | null;
  unlockedBadges: string[];
  completedQuests: DailyQuest[];
};

export function emptyByTopic(): Record<QuizTopicId, TopicStat> {
  const result = {} as Record<QuizTopicId, TopicStat>;
  for (const id of QUIZ_TOPIC_IDS) {
    result[id] = { answered: 0, correct: 0 };
  }
  return result;
}

export function emptyTotals(): ProgressTotals {
  return { answered: 0, correct: 0, bestStreak: 0, byTopic: emptyByTopic() };
}

export function accuracyPercent(correct: number, answered: number): number {
  return answered > 0 ? Math.round((correct / answered) * 100) : 0;
}

// --- XP & Seviye ------------------------------------------------------------

export const XP_BASE = 10;
const MAX_BONUS_STEPS = 10;

/**
 * Bu doğru cevaptan SONRAKİ üst üste doğru sayısına (>=1) göre XP.
 * Taban 10; her ardışık doğru +%10 (10 adıma kadar).
 */
export function computeXpGain(streakAfter: number): number {
  const steps = Math.min(Math.max(streakAfter - 1, 0), MAX_BONUS_STEPS);
  return Math.round(XP_BASE * (1 + steps * 0.1));
}

export type LevelInfo = {
  level: number;
  intoLevel: number;
  span: number;
  progress: number;
  levelStartXp: number;
  nextLevelXp: number;
};

function xpForLevelSpan(level: number): number {
  // level seviyesinden (level+1)'e geçmek için gereken XP
  return 100 + (level - 1) * 50;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  let levelStartXp = 0;
  let span = xpForLevelSpan(level);

  while (remaining >= span) {
    remaining -= span;
    levelStartXp += span;
    level += 1;
    span = xpForLevelSpan(level);
  }

  return {
    level,
    intoLevel: remaining,
    span,
    progress: span > 0 ? remaining / span : 0,
    levelStartXp,
    nextLevelXp: levelStartXp + span,
  };
}

// --- Rozetler ---------------------------------------------------------------

export type BadgeContext = {
  totals: ProgressTotals;
  xp: number;
  level: number;
  dailyStreak: number;
};

export type Badge = {
  id: string;
  label: string;
  description: string;
  icon: string;
  isEarned: (ctx: BadgeContext) => boolean;
};

export const BADGES: Badge[] = [
  {
    id: "first-correct",
    label: "İlk Doğru",
    description: "İlk doğru cevabını verdin.",
    icon: "🎯",
    isEarned: (c) => c.totals.correct >= 1,
  },
  {
    id: "correct-10",
    label: "On Doğru",
    description: "Toplam 10 doğru.",
    icon: "✅",
    isEarned: (c) => c.totals.correct >= 10,
  },
  {
    id: "correct-50",
    label: "Elli Doğru",
    description: "Toplam 50 doğru.",
    icon: "💪",
    isEarned: (c) => c.totals.correct >= 50,
  },
  {
    id: "correct-100",
    label: "Yüz Doğru",
    description: "Toplam 100 doğru.",
    icon: "🥇",
    isEarned: (c) => c.totals.correct >= 100,
  },
  {
    id: "streak-5",
    label: "Seri 5",
    description: "Üst üste 5 doğru.",
    icon: "🔥",
    isEarned: (c) => c.totals.bestStreak >= 5,
  },
  {
    id: "streak-10",
    label: "Seri 10",
    description: "Üst üste 10 doğru.",
    icon: "🔥",
    isEarned: (c) => c.totals.bestStreak >= 10,
  },
  {
    id: "streak-25",
    label: "Seri 25",
    description: "Üst üste 25 doğru.",
    icon: "⚡",
    isEarned: (c) => c.totals.bestStreak >= 25,
  },
  {
    id: "level-5",
    label: "Seviye 5",
    description: "5. seviyeye ulaştın.",
    icon: "⭐",
    isEarned: (c) => c.level >= 5,
  },
  {
    id: "level-10",
    label: "Seviye 10",
    description: "10. seviyeye ulaştın.",
    icon: "🌟",
    isEarned: (c) => c.level >= 10,
  },
  {
    id: "answered-100",
    label: "Çalışkan",
    description: "100 soru cevapladın.",
    icon: "📚",
    isEarned: (c) => c.totals.answered >= 100,
  },
  {
    id: "daily-7",
    label: "7 Gün Seri",
    description: "7 gün üst üste çalıştın.",
    icon: "📅",
    isEarned: (c) => c.dailyStreak >= 7,
  },
  {
    id: "topic-master",
    label: "Konu Ustası",
    description: "Bir konuda %90+ doğruluk (en az 10 soru).",
    icon: "🏆",
    isEarned: (c) =>
      PLUS_TOPIC_IDS.some((id) => {
        const stat = c.totals.byTopic[id];
        return stat.answered >= 10 && stat.correct / stat.answered >= 0.9;
      }),
  },
];

export function evaluateEarnedBadges(ctx: BadgeContext): string[] {
  return BADGES.filter((badge) => badge.isEarned(ctx)).map((badge) => badge.id);
}

export function getBadgeById(id: string): Badge | undefined {
  return BADGES.find((badge) => badge.id === id);
}

// --- Günlük görevler --------------------------------------------------------

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function getDailyQuests(dateKey: string): DailyQuest[] {
  const seed = hashString(dateKey);
  const topic = PLUS_TOPIC_IDS[seed % PLUS_TOPIC_IDS.length];

  return [
    {
      id: "answer-10",
      label: "10 soru cevapla",
      target: 10,
      progress: 0,
      done: false,
      xpReward: 25,
      topic: null,
      kind: "answer",
    },
    {
      id: "correct-5",
      label: "5 doğru yap",
      target: 5,
      progress: 0,
      done: false,
      xpReward: 30,
      topic: null,
      kind: "correct",
    },
    {
      id: `topic-${topic}`,
      label: `${plusTopicLabel(topic)} konusunda 3 doğru`,
      target: 3,
      progress: 0,
      done: false,
      xpReward: 35,
      topic,
      kind: "correct",
    },
  ];
}

export function emptyDaily(dateKey: string): DailyState {
  return { dateKey, quests: getDailyQuests(dateKey), dailyStreak: 0, lastActiveDate: "" };
}

/** Gün değiştiyse görevleri bugüne taşı; streak/lastActiveDate korunur. */
export function rolloverDaily(prev: DailyState | null, todayKey: string): DailyState {
  if (prev && prev.dateKey === todayKey && prev.quests.length > 0) {
    return prev;
  }
  return {
    dateKey: todayKey,
    quests: getDailyQuests(todayKey),
    dailyStreak: prev?.dailyStreak ?? 0,
    lastActiveDate: prev?.lastActiveDate ?? "",
  };
}

function isYesterday(dateKey: string, todayKey: string): boolean {
  if (!dateKey) {
    return false;
  }
  const previous = new Date(`${dateKey}T00:00:00`).getTime();
  const today = new Date(`${todayKey}T00:00:00`).getTime();
  return today - previous === 86_400_000;
}

/** Günün ilk cevabında günlük seriyi günceller. */
export function registerActiveDay(daily: DailyState, todayKey: string): DailyState {
  if (daily.lastActiveDate === todayKey) {
    return daily;
  }
  const dailyStreak = isYesterday(daily.lastActiveDate, todayKey) ? daily.dailyStreak + 1 : 1;
  return { ...daily, dailyStreak, lastActiveDate: todayKey };
}

export function applyAnswerToQuests(
  quests: DailyQuest[],
  input: { topic: QuizTopicId; isCorrect: boolean },
): { quests: DailyQuest[]; completed: DailyQuest[] } {
  const completed: DailyQuest[] = [];

  const next = quests.map((quest) => {
    if (quest.done) {
      return quest;
    }

    const topicMatches = quest.topic === null || quest.topic === input.topic;
    const counts = quest.kind === "answer" ? topicMatches : topicMatches && input.isCorrect;
    if (!counts) {
      return quest;
    }

    const progress = Math.min(quest.target, quest.progress + 1);
    const done = progress >= quest.target;
    const updated = { ...quest, progress, done };
    if (done) {
      completed.push(updated);
    }
    return updated;
  });

  return { quests: next, completed };
}
