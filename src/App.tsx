import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  economicFeatureCategories,
  economicFeatureTopics,
  getEconomicFeatures,
  type EconomicFeatureCategory,
  type EconomicFeatureProperties,
  type EconomicFeatureTopic,
} from "./geojson/economicFeatures";
import {
  getPhysicalFeatures,
  physicalFeatureCategories,
  physicalFeatureTopics,
  type PhysicalFeatureCategory,
  type PhysicalFeatureProperties,
  type PhysicalFeatureTopic,
} from "./geojson/physicalFeatures";
import { geoJsonSources } from "./geojson/sources";
import { useGeoJson } from "./hooks/useGeoJson";
import { TurkeyMap, type DistrictHighlight, type ProvinceHighlight } from "./maps/TurkeyMap";
import { QUIZ_CORRECT_RADIUS_KM, formatDistanceKm, getDistanceKm } from "./quiz/geoUtils";
import {
  generatePlusQuestion,
  getPlusAvailability,
  getPlusPlacementCorrectness,
  getPlusTargetCorrectness,
  type PlusPoint,
  type PlusQuestion,
  type PlusQuestionMode,
  type PlusQuestionTopic,
} from "./quiz/plusQuestionEngine";
import { buildProvinceQuizInfos } from "./quiz/provinceUtils";
import { buildDistrictQuizInfos, isPointInAnyPolygon } from "./quiz/districtUtils";
import { useAuth } from "./hooks/useAuth";
import { useQuizProgress } from "./hooks/useQuizProgress";
import { useLeaderboard } from "./hooks/useLeaderboard";
import { GamificationFX, buildFxItems, type FxItem } from "./components/GamificationFX";
import { Hud } from "./components/Hud";
import { TabBar, type AppTab } from "./components/TabBar";
import { ProfilePanel } from "./components/ProfilePanel";
import { QuizSheet, type PlusAnswerState, type PlusStudyMode } from "./components/QuizSheet";
import { LayersSheet } from "./components/LayersSheet";
import { TestPanel } from "./components/TestPanel";
import { useAutoAdvanceTimer } from "./hooks/useAutoAdvanceTimer";
import { useTestQuestions, type TestQuestionSource } from "./hooks/useTestQuestions";
import type { TestCategory } from "./quiz/testQuestions";
import { accuracyPercent, BADGES, formatDateKey, PLUS_TOPIC_IDS, plusTopicLabel as getPlusTopicLabel } from "./quiz/gamification";

const PLUS_RECENT_QUESTION_HISTORY_LIMIT = 16;
// Soru+ cevaplandıktan sonra bir sonraki soruya otomatik geçiş süresi.
const PLUS_AUTO_ADVANCE_MS = 3000;
const WRONG_PLUS_QUESTION_STORAGE_PREFIX = "kpss-cografya-atlas:wrong-plus-questions:";
const WRONG_TEST_QUESTION_STORAGE_PREFIX = "kpss-cografya-atlas:wrong-test-questions:";
// Aralıklı-tekrar-lite: bir soru yanlış havuzundan ancak üst üste bu kadar doğru
// yapılınca düşer. Her yanlış sayacı sıfırlar. Sayaçlar ayrı bir anahtarda tutulur.
const WRONG_PLUS_STREAK_STORAGE_PREFIX = "kpss-cografya-atlas:wrong-plus-streak:";
const WRONG_TEST_STREAK_STORAGE_PREFIX = "kpss-cografya-atlas:wrong-test-streak:";
const WRONG_POOL_CLEAR_STREAK = 2;
// C1: sınav geri sayımı + günlük XP hedefi.
const EXAM_DATE_STORAGE_KEY = "kpss-cografya-atlas:exam-date";
const DAILY_XP_STORAGE_KEY = "kpss-cografya-atlas:daily-xp";
const DAILY_XP_GOAL = 100;
// KPSS sınav tarihi (varsayılan): 6 Eylül 2026. Kullanıcı HUD'dan değiştirebilir.
const DEFAULT_EXAM_DATE = "2026-09-06";
// Test modu soru bankaları: her kaynak bir kategoriye (oyunlaştırma konusuna) karşılık gelir.
const TEST_QUESTION_SOURCES: TestQuestionSource[] = [
  { url: "/questions/tarih.json", category: "tarih" },
  { url: "/questions/vatandaslik.json", category: "vatandaslik" },
  { url: "/questions/cografya.json", category: "cografya" },
];
const PLUS_QUESTION_SEED_SEPARATOR = "__";

function plusQuestionSeedId(questionId: string) {
  return questionId.split(PLUS_QUESTION_SEED_SEPARATOR)[0];
}

function wrongPlusQuestionStorageKey(userId: string | null) {
  return `${WRONG_PLUS_QUESTION_STORAGE_PREFIX}${userId ?? "guest"}`;
}

function wrongTestQuestionStorageKey(userId: string | null) {
  return `${WRONG_TEST_QUESTION_STORAGE_PREFIX}${userId ?? "guest"}`;
}

function wrongPlusStreakStorageKey(userId: string | null) {
  return `${WRONG_PLUS_STREAK_STORAGE_PREFIX}${userId ?? "guest"}`;
}

function wrongTestStreakStorageKey(userId: string | null) {
  return `${WRONG_TEST_STREAK_STORAGE_PREFIX}${userId ?? "guest"}`;
}

function normalizeWrongPlusQuestionIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    if (typeof item === "string" && item.length > 0 && !seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  return result;
}

function readWrongPlusQuestionIds(storageKey: string) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    return normalizeWrongPlusQuestionIds(rawValue ? JSON.parse(rawValue) : []);
  } catch {
    return [];
  }
}

function writeWrongPlusQuestionIds(storageKey: string, questionIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (questionIds.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(questionIds));
  } catch {
    // localStorage kota/erişim hatası quiz akışını durdurmasın.
  }
}

// Yanlış havuzu sayaçları: { [soruId]: üst üste doğru sayısı }.
type WrongStreakMap = Record<string, number>;

function readWrongStreaks(storageKey: string): WrongStreakMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    const parsed = rawValue ? JSON.parse(rawValue) : {};
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const result: WrongStreakMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function writeWrongStreaks(storageKey: string, streaks: WrongStreakMap) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (Object.keys(streaks).length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(streaks));
  } catch {
    // yut
  }
}

/**
 * Bir cevaba göre yanlış havuzunu + sayaçları günceller (aralıklı-tekrar-lite).
 * - Yanlış: soru havuzun başına eklenir, sayaç 0'a düşer.
 * - Doğru & havuzda değil: dokunulmaz (ilk seferde doğru yapılan soru havuza girmez).
 * - Doğru & havuzda: sayaç +1; WRONG_POOL_CLEAR_STREAK'e ulaşınca havuzdan düşer.
 */
function applyWrongPoolAnswer(
  pool: string[],
  streaks: WrongStreakMap,
  id: string,
  isCorrect: boolean,
): { pool: string[]; streaks: WrongStreakMap } {
  if (!isCorrect) {
    return {
      pool: [id, ...pool.filter((questionId) => questionId !== id)],
      streaks: { ...streaks, [id]: 0 },
    };
  }

  if (!pool.includes(id)) {
    return { pool, streaks };
  }

  const nextStreak = (streaks[id] ?? 0) + 1;
  if (nextStreak >= WRONG_POOL_CLEAR_STREAK) {
    const { [id]: _removed, ...restStreaks } = streaks;
    return { pool: pool.filter((questionId) => questionId !== id), streaks: restStreaks };
  }

  return { pool, streaks: { ...streaks, [id]: nextStreak } };
}

// --- C1: sınav geri sayımı + günlük XP hedefi yardımcıları --------------------
type DailyXpState = { dateKey: string; xp: number };

function readExamDate(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const value = window.localStorage.getItem(EXAM_DATE_STORAGE_KEY);
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

function writeExamDate(value: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (value) {
      window.localStorage.setItem(EXAM_DATE_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(EXAM_DATE_STORAGE_KEY);
    }
  } catch {
    // yut
  }
}

function readDailyXp(todayKey: string): DailyXpState {
  if (typeof window === "undefined") {
    return { dateKey: todayKey, xp: 0 };
  }
  try {
    const raw = window.localStorage.getItem(DAILY_XP_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<DailyXpState>) : null;
    if (parsed && parsed.dateKey === todayKey && typeof parsed.xp === "number") {
      return { dateKey: todayKey, xp: Math.max(0, parsed.xp) };
    }
  } catch {
    // yut
  }
  return { dateKey: todayKey, xp: 0 };
}

function writeDailyXp(state: DailyXpState) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(DAILY_XP_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // yut
  }
}

/** Bugünün XP toplamına ekler; gün değiştiyse sıfırdan başlatır. */
function addDailyXp(current: DailyXpState, todayKey: string, gained: number): DailyXpState {
  if (current.dateKey !== todayKey) {
    return { dateKey: todayKey, xp: Math.max(0, gained) };
  }
  return { dateKey: todayKey, xp: current.xp + Math.max(0, gained) };
}

/** Bugünden sınav gününe kalan tam gün sayısı (geçmişse 0). */
function computeExamDaysLeft(examDate: string | null): number | null {
  if (!examDate) {
    return null;
  }
  const target = new Date(`${examDate}T00:00:00`).getTime();
  if (Number.isNaN(target)) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target - today.getTime()) / 86_400_000));
}

function App() {
  const [selectedProvinceName, setSelectedProvinceName] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<PhysicalFeatureProperties | null>(null);
  const [selectedEconomicFeature, setSelectedEconomicFeature] =
    useState<EconomicFeatureProperties | null>(null);
  const [mapGuesses, setMapGuesses] = useState<PlusPoint[]>([]);
  const [currentPlusQuestion, setCurrentPlusQuestion] = useState<PlusQuestion | null>(null);
  const [plusAnswer, setPlusAnswer] = useState<PlusAnswerState | null>(null);
  const [plusTopics, setPlusTopics] = useState<Array<Exclude<PlusQuestionTopic, "mixed">>>([]);
  const [plusMode, setPlusMode] = useState<PlusQuestionMode>("mixed");
  const [plusStudyMode, setPlusStudyMode] = useState<PlusStudyMode>("all");
  // Yanlış havuzları: havuz (pool) + aralıklı-tekrar sayaçları tek nesnede tutulur
  // ki güncelleme saf/atomik olsun (bkz. applyWrongPoolAnswer).
  const [wrongPlus, setWrongPlus] = useState<{ pool: string[]; streaks: WrongStreakMap }>(() => ({
    pool: readWrongPlusQuestionIds(wrongPlusQuestionStorageKey(null)),
    streaks: readWrongStreaks(wrongPlusStreakStorageKey(null)),
  }));
  const [activeTab, setActiveTab] = useState<AppTab>("harita");
  const [wrongTest, setWrongTest] = useState<{ pool: string[]; streaks: WrongStreakMap }>(() => ({
    pool: readWrongPlusQuestionIds(wrongTestQuestionStorageKey(null)),
    streaks: readWrongStreaks(wrongTestStreakStorageKey(null)),
  }));
  const wrongPlusQuestionIds = wrongPlus.pool;
  const wrongTestQuestionIds = wrongTest.pool;
  const [examDate, setExamDate] = useState<string | null>(() => readExamDate() ?? DEFAULT_EXAM_DATE);
  const [dailyXp, setDailyXp] = useState<DailyXpState>(() => readDailyXp(formatDateKey(new Date())));
  const [plusAssignments, setPlusAssignments] = useState<Record<string, string>>({});
  const [plusSelectedTokenId, setPlusSelectedTokenId] = useState<string | null>(null);
  const [plusSelectedTargetIds, setPlusSelectedTargetIds] = useState<string[]>([]);
  const [activeTopics, setActiveTopics] = useState<PhysicalFeatureTopic[]>(() =>
    physicalFeatureTopics.map((topic) => topic.id),
  );
  const [activeCategories, setActiveCategories] = useState<PhysicalFeatureCategory[]>(() =>
    physicalFeatureCategories.map((category) => category.id),
  );
  const [activeEconomicTopics, setActiveEconomicTopics] = useState<EconomicFeatureTopic[]>(() =>
    economicFeatureTopics.map((topic) => topic.id),
  );
  const [activeEconomicCategories, setActiveEconomicCategories] = useState<EconomicFeatureCategory[]>(() =>
    economicFeatureCategories.map((category) => category.id),
  );
  const recentPlusQuestionIdsRef = useRef<string[]>([]);
  const country = useGeoJson(geoJsonSources.country.url);
  const provinces = useGeoJson(geoJsonSources.provinces.url);
  // İlçe sınırları (~3.9 MB, 973 poligon) yalnızca kullanıcı "İlçeler" konusuyla
  // etkileşime girdiğinde yüklenir — açılışta diğer 4 kaynak gibi otomatik değil.
  const [shouldLoadDistricts, setShouldLoadDistricts] = useState(false);
  const districts = useGeoJson(shouldLoadDistricts ? geoJsonSources.districts.url : null);
  const physicalFeaturesData = useGeoJson(geoJsonSources.physicalFeatures.url);
  const economicFeaturesData = useGeoJson(geoJsonSources.economicFeatures.url);

  const auth = useAuth();
  const progress = useQuizProgress(auth.user);
  const leaderboard = useLeaderboard(auth.user);
  const { recordAnswer, reset: resetProgress } = progress;
  const { refresh: refreshLeaderboard } = leaderboard;
  const testQuestionsState = useTestQuestions(TEST_QUESTION_SOURCES);
  const wrongPlusQuestionStorageKeyValue = useMemo(
    () => wrongPlusQuestionStorageKey(auth.user?.id ?? null),
    [auth.user?.id],
  );
  const wrongTestQuestionStorageKeyValue = useMemo(
    () => wrongTestQuestionStorageKey(auth.user?.id ?? null),
    [auth.user?.id],
  );
  const wrongPlusStreakStorageKeyValue = useMemo(
    () => wrongPlusStreakStorageKey(auth.user?.id ?? null),
    [auth.user?.id],
  );
  const wrongTestStreakStorageKeyValue = useMemo(
    () => wrongTestStreakStorageKey(auth.user?.id ?? null),
    [auth.user?.id],
  );
  const [fxItems, setFxItems] = useState<FxItem[]>([]);
  const [layersOpen, setLayersOpen] = useState(false);
  const dismissFx = useCallback(
    (id: number) => setFxItems((items) => items.filter((item) => item.id !== id)),
    [],
  );

  useEffect(() => {
    setWrongPlus({
      pool: readWrongPlusQuestionIds(wrongPlusQuestionStorageKeyValue),
      streaks: readWrongStreaks(wrongPlusStreakStorageKeyValue),
    });
  }, [wrongPlusQuestionStorageKeyValue, wrongPlusStreakStorageKeyValue]);

  useEffect(() => {
    setWrongTest({
      pool: readWrongPlusQuestionIds(wrongTestQuestionStorageKeyValue),
      streaks: readWrongStreaks(wrongTestStreakStorageKeyValue),
    });
  }, [wrongTestQuestionStorageKeyValue, wrongTestStreakStorageKeyValue]);

  // Yanlış havuzu güncelleyicileri: cevaba göre havuz + sayaçları atomik günceller.
  const recordWrongPlusAnswer = useCallback(
    (questionId: string, isCorrect: boolean) => {
      setWrongPlus((current) => {
        const next = applyWrongPoolAnswer(current.pool, current.streaks, questionId, isCorrect);
        writeWrongPlusQuestionIds(wrongPlusQuestionStorageKeyValue, next.pool);
        writeWrongStreaks(wrongPlusStreakStorageKeyValue, next.streaks);
        return next;
      });
    },
    [wrongPlusQuestionStorageKeyValue, wrongPlusStreakStorageKeyValue],
  );

  const recordWrongTestAnswer = useCallback(
    (questionId: string, isCorrect: boolean) => {
      setWrongTest((current) => {
        const next = applyWrongPoolAnswer(current.pool, current.streaks, questionId, isCorrect);
        writeWrongPlusQuestionIds(wrongTestQuestionStorageKeyValue, next.pool);
        writeWrongStreaks(wrongTestStreakStorageKeyValue, next.streaks);
        return next;
      });
    },
    [wrongTestQuestionStorageKeyValue, wrongTestStreakStorageKeyValue],
  );

  const clearWrongPlus = useCallback(() => {
    setWrongPlus({ pool: [], streaks: {} });
    writeWrongPlusQuestionIds(wrongPlusQuestionStorageKeyValue, []);
    writeWrongStreaks(wrongPlusStreakStorageKeyValue, {});
  }, [wrongPlusQuestionStorageKeyValue, wrongPlusStreakStorageKeyValue]);

  // C1: bir cevaptan kazanılan XP'yi bugünün hedef sayacına ekler.
  const addTodayXp = useCallback((gained: number) => {
    if (gained <= 0) {
      return;
    }
    setDailyXp((current) => {
      const next = addDailyXp(current, formatDateKey(new Date()), gained);
      writeDailyXp(next);
      return next;
    });
  }, []);

  const examDaysLeft = useMemo(() => computeExamDaysLeft(examDate), [examDate]);

  const handleSetExamDate = useCallback(() => {
    const input = window.prompt("KPSS sınav tarihini gir (YYYY-AA-GG):", examDate ?? "");
    if (input === null) {
      return;
    }
    const trimmed = input.trim();
    if (trimmed === "") {
      setExamDate(null);
      writeExamDate(null);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isNaN(new Date(`${trimmed}T00:00:00`).getTime())) {
      window.alert("Geçersiz tarih. Örnek: 2026-07-19");
      return;
    }
    setExamDate(trimmed);
    writeExamDate(trimmed);
  }, [examDate]);

  const handleTestAnswer = useCallback(
    ({
      questionId,
      isCorrect,
      category,
    }: {
      questionId: string;
      isCorrect: boolean;
      category: TestCategory;
    }) => {
      recordWrongTestAnswer(questionId, isCorrect);

      const events = recordAnswer({ topic: category, isCorrect });
      addTodayXp(events.xpGained);
      const builtFx = buildFxItems(events);
      if (builtFx.length > 0) {
        setFxItems((items) => [...items, ...builtFx]);
      }
    },
    [recordWrongTestAnswer, recordAnswer, addTodayXp],
  );

  const accountDisplayName =
    (auth.user?.user_metadata?.username as string | undefined) ?? auth.user?.email ?? "Oyuncu";
  const weakTopicRows = useMemo(
    () =>
      PLUS_TOPIC_IDS.map((id) => ({ id, label: getPlusTopicLabel(id), stat: progress.totals.byTopic[id] }))
        .filter((row) => row.stat.answered > 0)
        .sort((a, b) => {
          const accuracyA = a.stat.correct / a.stat.answered;
          const accuracyB = b.stat.correct / b.stat.answered;
          if (accuracyA !== accuracyB) {
            return accuracyA - accuracyB;
          }
          return b.stat.answered - a.stat.answered;
        }),
    [progress.totals],
  );

  const nextBadge = useMemo(() => BADGES.find((badge) => !progress.badges.includes(badge.id)) ?? null, [progress.badges]);

  const handleResetProgress = useCallback(() => {
    if (window.confirm("İlerlemen, XP'n ve rozetlerin sıfırlansın mı?")) {
      void resetProgress();
      refreshLeaderboard();
    }
  }, [refreshLeaderboard, resetProgress]);

  const physicalFeatures = useMemo(
    () => getPhysicalFeatures(physicalFeaturesData.data),
    [physicalFeaturesData.data],
  );
  const economicFeatures = useMemo(
    () => getEconomicFeatures(economicFeaturesData.data),
    [economicFeaturesData.data],
  );
  const visiblePhysicalFeatures = useMemo(
    () =>
      physicalFeatures.filter(
        (feature) =>
          activeTopics.includes(feature.properties.topic) &&
          activeCategories.includes(feature.properties.category),
      ),
    [activeCategories, activeTopics, physicalFeatures],
  );
  const visibleEconomicFeatures = useMemo(
    () =>
      economicFeatures.filter(
        (feature) =>
          activeEconomicTopics.includes(feature.properties.topic) &&
          activeEconomicCategories.includes(feature.properties.category),
      ),
    [activeEconomicCategories, activeEconomicTopics, economicFeatures],
  );
  const quizQuestionPool = useMemo(
    () => [...visiblePhysicalFeatures, ...visibleEconomicFeatures],
    [visibleEconomicFeatures, visiblePhysicalFeatures],
  );
  const allQuizQuestionPool = useMemo(
    () => [...physicalFeatures, ...economicFeatures],
    [economicFeatures, physicalFeatures],
  );
  const activePlusQuestionPool = plusStudyMode === "wrong" ? allQuizQuestionPool : quizQuestionPool;
  const activeWrongPlusQuestionIds = plusStudyMode === "wrong" ? wrongPlusQuestionIds : undefined;
  const provinceQuizInfos = useMemo(() => buildProvinceQuizInfos(provinces.data), [provinces.data]);
  const districtQuizInfos = useMemo(() => buildDistrictQuizInfos(districts.data), [districts.data]);
  const districtQuizInfoById = useMemo(
    () => new Map(districtQuizInfos.map((district) => [district.id, district])),
    [districtQuizInfos],
  );
  const plusAvailability = useMemo(
    () =>
      getPlusAvailability(
        activePlusQuestionPool,
        plusTopics,
        plusMode,
        activeWrongPlusQuestionIds,
        provinceQuizInfos,
        districtQuizInfos,
      ),
    [activePlusQuestionPool, activeWrongPlusQuestionIds, districtQuizInfos, plusMode, plusTopics, provinceQuizInfos],
  );
  const isLoading =
    country.isLoading || provinces.isLoading || physicalFeaturesData.isLoading || economicFeaturesData.isLoading;
  const error = country.error ?? provinces.error ?? physicalFeaturesData.error ?? economicFeaturesData.error;
  const shouldUsePhysicalCategoryColors = activeTopics.length === 1;
  const shouldUseEconomicCategoryColors = activeEconomicTopics.length === 1;
  const canStartPlus =
    plusAvailability.total > 0 && !physicalFeaturesData.isLoading && !economicFeaturesData.isLoading;
  const wrongPlusQuestionCount = wrongPlusQuestionIds.length;
  const plusAvailabilityLabel =
    plusStudyMode === "wrong" ? `${plusAvailability.total}/${wrongPlusQuestionCount} yanlış` : `${plusAvailability.total} soru`;
  const wrongPlusQuestionStatus =
    wrongPlusQuestionCount === 0
      ? "Yanlış cevapladığın sorular burada birikir."
      : plusAvailability.total === 0
        ? "Seçili konu veya soru tipine uyan yanlış soru yok."
        : `${plusAvailability.total} yanlış soru bu ayarlarla çalışılabilir.`;
  const isPlusActive = Boolean(currentPlusQuestion);

  useEffect(() => {
    if (
      selectedFeature &&
      (!activeTopics.includes(selectedFeature.topic) || !activeCategories.includes(selectedFeature.category))
    ) {
      setSelectedFeature(null);
    }
  }, [activeCategories, activeTopics, selectedFeature]);

  useEffect(() => {
    if (
      selectedEconomicFeature &&
      (!activeEconomicTopics.includes(selectedEconomicFeature.topic) ||
        !activeEconomicCategories.includes(selectedEconomicFeature.category))
    ) {
      setSelectedEconomicFeature(null);
    }
  }, [activeEconomicCategories, activeEconomicTopics, selectedEconomicFeature]);

  useEffect(() => {
    if (!currentPlusQuestion) {
      return;
    }

    const isUnavailableInPool =
      currentPlusQuestion.topic !== "province" &&
      currentPlusQuestion.topic !== "district" &&
      !currentPlusQuestion.targets.every((target) =>
        activePlusQuestionPool.some((feature) => feature.properties.id === target.id),
      );
    const isOutsideWrongPool =
      plusStudyMode === "wrong" &&
      !plusAnswer &&
      !wrongPlusQuestionIds.includes(plusQuestionSeedId(currentPlusQuestion.id));

    if (isUnavailableInPool || isOutsideWrongPool) {
      setCurrentPlusQuestion(null);
      setPlusAnswer(null);
      setPlusAssignments({});
      setPlusSelectedTokenId(null);
      setPlusSelectedTargetIds([]);
    }
  }, [activePlusQuestionPool, currentPlusQuestion, plusAnswer, plusStudyMode, wrongPlusQuestionIds]);

  const startNextPlusQuestion = useCallback(() => {
    const nextQuestion = generatePlusQuestion({
      features: activePlusQuestionPool,
      topics: plusTopics,
      mode: plusMode,
      recentQuestionIds: recentPlusQuestionIdsRef.current,
      questionIds: activeWrongPlusQuestionIds,
      provinces: provinceQuizInfos,
      districts: districtQuizInfos,
    });

    if (!nextQuestion) {
      return;
    }

    recentPlusQuestionIdsRef.current = [nextQuestion.id, ...recentPlusQuestionIdsRef.current].slice(
      0,
      PLUS_RECENT_QUESTION_HISTORY_LIMIT,
    );

    setCurrentPlusQuestion(nextQuestion);
    setPlusAnswer(null);
    setPlusAssignments({});
    setPlusSelectedTokenId(null);
    setPlusSelectedTargetIds([]);
    setMapGuesses([]);
    setSelectedProvinceName(null);
    setSelectedFeature(null);
    setSelectedEconomicFeature(null);
  }, [
    activePlusQuestionPool,
    activeWrongPlusQuestionIds,
    districtQuizInfos,
    plusMode,
    plusTopics,
    provinceQuizInfos,
  ]);

  const handleProvinceSelect = useCallback((provinceName: string) => {
    setSelectedProvinceName(provinceName);
    setSelectedFeature(null);
    setSelectedEconomicFeature(null);
  }, []);

  const handlePhysicalFeatureSelect = useCallback((feature: PhysicalFeatureProperties) => {
    setSelectedFeature(feature);
    setSelectedProvinceName(null);
    setSelectedEconomicFeature(null);
  }, []);

  const handleEconomicFeatureSelect = useCallback((feature: EconomicFeatureProperties) => {
    setSelectedEconomicFeature(feature);
    setSelectedProvinceName(null);
    setSelectedFeature(null);
  }, []);

  const handleTopicToggle = useCallback(
    (topicId: PhysicalFeatureTopic) => {
      const topicCategoryIds = physicalFeatureCategories
        .filter((category) => category.topic === topicId)
        .map((category) => category.id);
      const isActive = activeTopics.includes(topicId);

      setActiveTopics((current) =>
        isActive ? current.filter((currentTopic) => currentTopic !== topicId) : [...current, topicId],
      );
      setActiveCategories((current) =>
        isActive
          ? current.filter((categoryId) => !topicCategoryIds.includes(categoryId))
          : Array.from(new Set([...current, ...topicCategoryIds])),
      );
    },
    [activeTopics],
  );

  const handleCategoryToggle = useCallback(
    (categoryId: PhysicalFeatureCategory) => {
      const topicId = physicalFeatureCategories.find((category) => category.id === categoryId)?.topic;
      const isCategoryActive = activeCategories.includes(categoryId);
      const nextCategories = isCategoryActive
        ? activeCategories.filter((currentCategory) => currentCategory !== categoryId)
        : [...activeCategories, categoryId];

      setActiveCategories(nextCategories);

      if (!topicId) {
        return;
      }
      const topicHasActiveCategory = nextCategories.some(
        (currentCategory) =>
          physicalFeatureCategories.find((category) => category.id === currentCategory)?.topic === topicId,
      );
      setActiveTopics((current) =>
        topicHasActiveCategory
          ? current.includes(topicId)
            ? current
            : [...current, topicId]
          : current.filter((currentTopic) => currentTopic !== topicId),
      );
    },
    [activeCategories],
  );

  const handleSelectAllTopics = useCallback(() => {
    setActiveTopics(physicalFeatureTopics.map((topic) => topic.id));
    setActiveCategories(physicalFeatureCategories.map((category) => category.id));
  }, []);

  const handleClearAllTopics = useCallback(() => {
    setActiveTopics([]);
    setActiveCategories([]);
  }, []);

  const handleEconomicTopicToggle = useCallback(
    (topicId: EconomicFeatureTopic) => {
      const topicCategoryIds = economicFeatureCategories
        .filter((category) => category.topic === topicId)
        .map((category) => category.id);
      const isActive = activeEconomicTopics.includes(topicId);

      setActiveEconomicTopics((current) =>
        isActive ? current.filter((currentTopic) => currentTopic !== topicId) : [...current, topicId],
      );
      setActiveEconomicCategories((current) =>
        isActive
          ? current.filter((categoryId) => !topicCategoryIds.includes(categoryId))
          : Array.from(new Set([...current, ...topicCategoryIds])),
      );
    },
    [activeEconomicTopics],
  );

  const handleEconomicCategoryToggle = useCallback(
    (categoryId: EconomicFeatureCategory) => {
      const topicId = economicFeatureCategories.find((category) => category.id === categoryId)?.topic;
      const isCategoryActive = activeEconomicCategories.includes(categoryId);
      const nextCategories = isCategoryActive
        ? activeEconomicCategories.filter((currentCategory) => currentCategory !== categoryId)
        : [...activeEconomicCategories, categoryId];

      setActiveEconomicCategories(nextCategories);

      if (!topicId) {
        return;
      }
      const topicHasActiveCategory = nextCategories.some(
        (currentCategory) =>
          economicFeatureCategories.find((category) => category.id === currentCategory)?.topic === topicId,
      );
      setActiveEconomicTopics((current) =>
        topicHasActiveCategory
          ? current.includes(topicId)
            ? current
            : [...current, topicId]
          : current.filter((currentTopic) => currentTopic !== topicId),
      );
    },
    [activeEconomicCategories],
  );

  const handleSelectAllEconomicTopics = useCallback(() => {
    setActiveEconomicTopics(economicFeatureTopics.map((topic) => topic.id));
    setActiveEconomicCategories(economicFeatureCategories.map((category) => category.id));
  }, []);

  const handleClearAllEconomicTopics = useCallback(() => {
    setActiveEconomicTopics([]);
    setActiveEconomicCategories([]);
  }, []);

  const handlePlusClose = useCallback(() => {
    setCurrentPlusQuestion(null);
    setPlusAnswer(null);
    setPlusAssignments({});
    setPlusSelectedTokenId(null);
    setPlusSelectedTargetIds([]);
  }, []);

  const handlePrimaryPlusAction = useCallback(() => {
    setShouldLoadDistricts(true);

    if (!canStartPlus) {
      return;
    }

    startNextPlusQuestion();
  }, [canStartPlus, startNextPlusQuestion]);

  const resetPlusQuestionState = useCallback(() => {
    setCurrentPlusQuestion(null);
    setPlusAnswer(null);
    setPlusAssignments({});
    setPlusSelectedTokenId(null);
    setPlusSelectedTargetIds([]);
  }, []);

  // Soru+ sekmesinden ayrılınca aktif soru kapanır: Harita sekmesi her zaman
  // serbest keşif modudur ve otomatik-ilerleme sayacı sekme dışında çalışmaz.
  const handleTabChange = useCallback(
    (tab: AppTab) => {
      if (tab !== "soru") {
        resetPlusQuestionState();
        setMapGuesses([]);
      }
      setActiveTab(tab);
    },
    [resetPlusQuestionState],
  );

  const handlePlusStudyModeChange = useCallback(
    (mode: PlusStudyMode) => {
      setPlusStudyMode(mode);
      recentPlusQuestionIdsRef.current = [];
      resetPlusQuestionState();
      setMapGuesses([]);
    },
    [resetPlusQuestionState],
  );

  const handleWrongPlusQuestionPoolClear = useCallback(() => {
    if (!window.confirm("Yanlış soru havuzu temizlensin mi?")) {
      return;
    }

    clearWrongPlus();
    if (plusStudyMode === "wrong") {
      resetPlusQuestionState();
      setMapGuesses([]);
    }
  }, [clearWrongPlus, plusStudyMode, resetPlusQuestionState]);

  const handlePlusTopicToggle = useCallback(
    (topic: Exclude<PlusQuestionTopic, "mixed">) => {
      if (topic === "district") {
        setShouldLoadDistricts(true);
      }

      setPlusTopics((current) =>
        current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic],
      );
      resetPlusQuestionState();
    },
    [resetPlusQuestionState],
  );

  const handlePlusTopicsClear = useCallback(() => {
    setPlusTopics([]);
    resetPlusQuestionState();
  }, [resetPlusQuestionState]);

  // Performans panelinden "zayıf konuya tıkla → o konuda pratik yap".
  const handleWeakTopicPractice = useCallback(
    (topic: Exclude<PlusQuestionTopic, "mixed">) => {
      setPlusTopics([topic]);
      setPlusStudyMode("all");
      setPlusMode("mixed");
      resetPlusQuestionState();
      setMapGuesses([]);
      setActiveTab("soru");
    },
    [resetPlusQuestionState],
  );

  const handlePlusModeChange = useCallback((mode: PlusQuestionMode) => {
    setPlusMode(mode);
    setCurrentPlusQuestion(null);
    setPlusAnswer(null);
    setPlusAssignments({});
    setPlusSelectedTokenId(null);
    setPlusSelectedTargetIds([]);
    setMapGuesses([]);
  }, []);

  const finalizePlusAnswer = useCallback(
    ({
      isCorrect,
      message,
      detail,
      wrongTargetIds,
      selectedTokenId,
    }: {
      isCorrect: boolean;
      message: string;
      detail: string;
      wrongTargetIds: string[];
      selectedTokenId: string | null;
    }) => {
      if (!currentPlusQuestion || plusAnswer) {
        return;
      }

      const currentQuestionSeedId = plusQuestionSeedId(currentPlusQuestion.id);
      recordWrongPlusAnswer(currentQuestionSeedId, isCorrect);
      setPlusAnswer({ isCorrect, message, detail, wrongTargetIds, selectedTokenId });
      setPlusSelectedTokenId(null);

      const events = recordAnswer({ topic: currentPlusQuestion.topic, isCorrect });
      addTodayXp(events.xpGained);
      const builtFx = buildFxItems(events);
      if (builtFx.length > 0) {
        setFxItems((items) => [...items, ...builtFx]);
      }
    },
    [currentPlusQuestion, recordWrongPlusAnswer, plusAnswer, recordAnswer, addTodayXp],
  );

  const handlePlusTokenSelect = useCallback(
    (tokenId: string) => {
      if (!currentPlusQuestion || plusAnswer) {
        return;
      }

      if (currentPlusQuestion.kind === "choice" || currentPlusQuestion.kind === "mapMatch") {
        const isCorrect = tokenId === currentPlusQuestion.correctTokenId;
        const selectedToken = currentPlusQuestion.tokens.find((token) => token.id === tokenId);

        finalizePlusAnswer({
          isCorrect,
          message: isCorrect ? "Doğru." : "Yanlış.",
          detail: isCorrect
            ? currentPlusQuestion.answerSummary
            : `Doğru cevap: ${currentPlusQuestion.answerSummary}. Seçimin: ${selectedToken?.label ?? "?"}.`,
          wrongTargetIds: isCorrect ? [] : currentPlusQuestion.correctTargetIds,
          selectedTokenId: tokenId,
        });
        return;
      }

      setPlusSelectedTokenId((currentTokenId) => (currentTokenId === tokenId ? null : tokenId));
    },
    [currentPlusQuestion, finalizePlusAnswer, plusAnswer],
  );

  const assignPlusTokenToTarget = useCallback(
    (targetId: string, tokenId: string) => {
      if (!currentPlusQuestion || currentPlusQuestion.kind !== "placement" || plusAnswer) {
        return;
      }

      setPlusAssignments((currentAssignments) => ({
        ...currentAssignments,
        [targetId]: tokenId,
      }));
      setPlusSelectedTokenId(null);
    },
    [currentPlusQuestion, plusAnswer],
  );

  const handlePlusTargetSelect = useCallback(
    (targetId: string) => {
      if (!currentPlusQuestion || plusAnswer) {
        return;
      }

      if (currentPlusQuestion.kind === "placement") {
        if (plusSelectedTokenId) {
          assignPlusTokenToTarget(targetId, plusSelectedTokenId);
        }

        return;
      }

      if (currentPlusQuestion.kind === "pickOne") {
        const isCorrect = currentPlusQuestion.correctTargetIds.includes(targetId);
        const selectedTarget = currentPlusQuestion.targets.find((target) => target.id === targetId);

        finalizePlusAnswer({
          isCorrect,
          message: isCorrect ? "Doğru." : "Yanlış.",
          detail: isCorrect
            ? currentPlusQuestion.answerSummary
            : `Doğru cevap: ${currentPlusQuestion.answerSummary}. Seçimin: ${selectedTarget?.name ?? "?"}.`,
          wrongTargetIds: isCorrect ? [] : [targetId],
          selectedTokenId: null,
        });
        setPlusSelectedTargetIds([targetId]);
        return;
      }

      if (currentPlusQuestion.kind === "pickMany") {
        setPlusSelectedTargetIds((currentIds) =>
          currentIds.includes(targetId)
            ? currentIds.filter((currentId) => currentId !== targetId)
            : [...currentIds, targetId],
        );
      }
    },
    [assignPlusTokenToTarget, currentPlusQuestion, finalizePlusAnswer, plusAnswer, plusSelectedTokenId],
  );

  const handlePlusSubmit = useCallback(() => {
    if (!currentPlusQuestion || plusAnswer) {
      return;
    }

    if (currentPlusQuestion.kind === "placement") {
      const results = getPlusPlacementCorrectness(currentPlusQuestion, plusAssignments);
      const wrongTargetIds = results.filter((result) => !result.isCorrect).map((result) => result.targetId);
      const isCorrect = wrongTargetIds.length === 0;

      finalizePlusAnswer({
        isCorrect,
        message: isCorrect ? "Doğru." : "Yanlış.",
        detail: isCorrect
          ? currentPlusQuestion.answerSummary
          : `Doğru yerleştirme: ${currentPlusQuestion.answerSummary}.`,
        wrongTargetIds,
        selectedTokenId: null,
      });
      return;
    }

    if (currentPlusQuestion.kind === "pickMany") {
      const result = getPlusTargetCorrectness(currentPlusQuestion, plusSelectedTargetIds);

      finalizePlusAnswer({
        isCorrect: result.isCorrect,
        message: result.isCorrect ? "Doğru." : "Yanlış.",
        detail: result.isCorrect
          ? currentPlusQuestion.answerSummary
          : `Doğru cevap: ${currentPlusQuestion.answerSummary}.`,
        wrongTargetIds: [...result.wrongTargetIds, ...result.missedTargetIds],
        selectedTokenId: null,
      });
    }
  }, [currentPlusQuestion, finalizePlusAnswer, plusAnswer, plusAssignments, plusSelectedTargetIds]);

  const handlePlusMapGuess = useCallback(
    (guess: PlusPoint) => {
      const target = currentPlusQuestion?.kind === "mapLocate" && !plusAnswer ? currentPlusQuestion.targets[0] : null;

      if (!target || !currentPlusQuestion) {
        return;
      }

      let isCorrect: boolean;
      let detail: string;

      if (currentPlusQuestion.topic === "district") {
        // İlçe boyutu/şekli çok değişken olduğundan (yarım km²'den geniş kırsal
        // ilçelere kadar), sabit yarıçap yerine gerçek sınır içinde mi kontrolü
        // yapılır — noktasal öğeler için ayarlanmış 75 km'lik yarıçap burada
        // neredeyse her tıklamayı "doğru" sayardı.
        const info = districtQuizInfoById.get(target.id);
        isCorrect = info ? isPointInAnyPolygon(guess, info.polygons) : false;
        detail = isCorrect
          ? `Doğru! Nokta ${target.name} ilçesinin sınırları içinde.`
          : `Yanlış. Nokta ${target.name} ilçesinin sınırları dışında kaldı. Doğru sınır haritada gösterildi.`;
      } else {
        const distanceKm = getDistanceKm(guess, target.point);
        isCorrect = distanceKm <= QUIZ_CORRECT_RADIUS_KM;
        detail = isCorrect
          ? `${formatDistanceKm(distanceKm)} km uzaklıkta işaretledin.`
          : `${formatDistanceKm(distanceKm)} km uzaktasın. Doğru nokta haritada gösterildi.`;
      }

      setMapGuesses([guess]);
      setSelectedProvinceName(null);
      setSelectedFeature(null);
      setSelectedEconomicFeature(null);
      finalizePlusAnswer({
        isCorrect,
        message: isCorrect ? "Doğru." : "Yanlış.",
        detail,
        wrongTargetIds: [],
        selectedTokenId: null,
      });
    },
    [currentPlusQuestion, districtQuizInfoById, finalizePlusAnswer, plusAnswer],
  );

  const plusResultStatus = plusAnswer ? (plusAnswer.isCorrect ? "correct" : "wrong") : null;
  const plusAutoAdvanceRemainingMs = useAutoAdvanceTimer(
    Boolean(plusAnswer),
    PLUS_AUTO_ADVANCE_MS,
    startNextPlusQuestion,
  );
  const isProvinceQuestion = currentPlusQuestion?.topic === "province";
  const plusHighlightProvinces = useMemo<ProvinceHighlight[]>(() => {
    if (!isProvinceQuestion || !plusAnswer || !currentPlusQuestion) {
      return [];
    }

    return currentPlusQuestion.tokens.map((token) => ({
      name: token.label,
      status:
        token.id === currentPlusQuestion.correctTokenId
          ? "correct"
          : token.id === plusAnswer.selectedTokenId
            ? "wrong"
            : "option",
    }));
  }, [currentPlusQuestion, isProvinceQuestion, plusAnswer]);
  const isDistrictChoiceQuestion = currentPlusQuestion?.topic === "district" && currentPlusQuestion.kind === "choice";
  const plusHighlightDistricts = useMemo<DistrictHighlight[]>(() => {
    if (!isDistrictChoiceQuestion || !plusAnswer || !currentPlusQuestion) {
      return [];
    }

    return currentPlusQuestion.tokens.map((token) => ({
      id: token.id,
      status:
        token.id === currentPlusQuestion.correctTokenId
          ? "correct"
          : token.id === plusAnswer.selectedTokenId
            ? "wrong"
            : "option",
    }));
  }, [currentPlusQuestion, isDistrictChoiceQuestion, plusAnswer]);
  const isPlusMapLocateQuestion = currentPlusQuestion?.kind === "mapLocate";
  const isPlusMapLocateActive = Boolean(isPlusMapLocateQuestion && !plusAnswer);
  const plusMapLocateTarget = isPlusMapLocateQuestion ? currentPlusQuestion?.targets[0] ?? null : null;
  const isDistrictMapLocateQuestion = isPlusMapLocateQuestion && currentPlusQuestion?.topic === "district";
  const plusMapLocateDistrictTargetId =
    isDistrictMapLocateQuestion && plusAnswer ? plusMapLocateTarget?.id ?? null : null;
  const plusTokenById = useMemo(
    () => new Map(currentPlusQuestion?.tokens.map((token) => [token.id, token]) ?? []),
    [currentPlusQuestion],
  );
  const plusAssignedTokenLabels = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(plusAssignments).map(([targetId, tokenId]) => [
          targetId,
          plusTokenById.get(tokenId)?.label ?? "",
        ]),
      ),
    [plusAssignments, plusTokenById],
  );
  // TurkeyMap'in quiz katmanı effect'i bu dizilere referansla bağlı: her
  // render'da yeni dizi üretmek, effect'in her tikte (ör. otomatik ilerleme
  // sayacı) markerları söküp yeniden kurmasına ve kalıcı tooltip kopyalarının
  // sızmasına yol açıyordu — kimlikleri sabitle.
  const plusVisibleSelectedTargetIds = useMemo(
    () => (currentPlusQuestion?.kind === "placement" ? Object.keys(plusAssignments) : plusSelectedTargetIds),
    [currentPlusQuestion, plusAssignments, plusSelectedTargetIds],
  );
  const plusCorrectTargetIds = useMemo(
    () => (plusAnswer ? currentPlusQuestion?.correctTargetIds ?? [] : []),
    [currentPlusQuestion, plusAnswer],
  );
  const plusWrongTargetIds = useMemo(() => plusAnswer?.wrongTargetIds ?? [], [plusAnswer]);
  const plusTargetsForMap = useMemo(
    () => (isPlusMapLocateQuestion ? [] : currentPlusQuestion?.targets ?? []),
    [currentPlusQuestion, isPlusMapLocateQuestion],
  );
  const isPlusSubmitVisible =
    currentPlusQuestion?.kind === "placement" || currentPlusQuestion?.kind === "pickMany";
  const isPlusSubmitDisabled =
    !currentPlusQuestion ||
    Boolean(plusAnswer) ||
    (currentPlusQuestion.kind === "placement"
      ? Object.keys(plusAssignments).length < currentPlusQuestion.targets.length
      : currentPlusQuestion.kind === "pickMany"
        ? plusSelectedTargetIds.length === 0
        : true);
  const isMapVisibleTab = activeTab === "harita" || activeTab === "soru";

  return (
    <div className={`app-shell${activeTab === "soru" ? " app-shell--soru" : ""}`}>
        <section className={`map-stage${isMapVisibleTab ? "" : " map-stage--hidden"}`}>
          <TurkeyMap
            countryData={country.data}
            provincesData={provinces.data}
            districtsData={districts.data}
            physicalFeaturesData={physicalFeaturesData.data}
            economicFeaturesData={economicFeaturesData.data}
            activePhysicalTopics={activeTopics}
            activePhysicalCategories={activeCategories}
            activeEconomicTopics={activeEconomicTopics}
            activeEconomicCategories={activeEconomicCategories}
            shouldUsePhysicalCategoryColors={shouldUsePhysicalCategoryColors}
            shouldUseEconomicCategoryColors={shouldUseEconomicCategoryColors}
            selectedProvinceName={selectedProvinceName}
            selectedPhysicalFeatureId={selectedFeature?.id ?? null}
            selectedEconomicFeatureId={selectedEconomicFeature?.id ?? null}
            isPlusActive={isPlusActive}
            isPlusMapLocateActive={isPlusMapLocateActive}
            plusHideProvinces={isPlusActive}
            plusHighlightProvinces={plusHighlightProvinces}
            plusHighlightDistricts={plusHighlightDistricts}
            plusMapLocateDistrictTargetId={plusMapLocateDistrictTargetId}
            plusGuessPoints={mapGuesses}
            plusMapLocateTargetName={plusMapLocateTarget?.name ?? "Soru"}
            plusMapLocateTargetPoint={plusMapLocateTarget?.point ?? null}
            plusMapLocateShowTargetPoint={plusMapLocateTarget ? Boolean(plusAnswer) : false}
            plusTargets={plusTargetsForMap}
            plusSelectedTargetIds={plusVisibleSelectedTargetIds}
            plusCorrectTargetIds={plusCorrectTargetIds}
            plusWrongTargetIds={plusWrongTargetIds}
            plusAssignedTokenLabels={plusAssignedTokenLabels}
            plusResultStatus={plusResultStatus}
            onProvinceSelect={handleProvinceSelect}
            onPhysicalFeatureSelect={handlePhysicalFeatureSelect}
            onEconomicFeatureSelect={handleEconomicFeatureSelect}
            onPlusMapGuess={handlePlusMapGuess}
            onPlusTargetSelect={handlePlusTargetSelect}
          />

          {(isLoading || error) && (
            <div className="map-state glass" role="status">
              <strong>{error ? "Harita verisi yüklenemedi" : "Harita hazırlanıyor"}</strong>
              <span>{error ?? "Türkiye, il sınırları, fiziki ve ekonomik GeoJSON katmanları yükleniyor."}</span>
            </div>
          )}
        </section>

        <Hud
          isLoggedIn={Boolean(auth.user)}
          level={progress.level.level}
          levelProgress={progress.level.progress}
          streak={progress.daily.dailyStreak}
          dailyXp={dailyXp.xp}
          dailyXpGoal={DAILY_XP_GOAL}
        />

        {activeTab === "soru" ? (
          <QuizSheet
            question={currentPlusQuestion}
            answer={plusAnswer}
            availabilityLabel={plusAvailabilityLabel}
            availability={plusAvailability}
            studyMode={plusStudyMode}
            mode={plusMode}
            topics={plusTopics}
            canStart={canStartPlus}
            wrongCount={wrongPlusQuestionCount}
            wrongStatus={wrongPlusQuestionStatus}
            session={progress.session}
            districtsLoading={districts.isLoading}
            districtsError={districts.error}
            assignments={plusAssignments}
            selectedTokenId={plusSelectedTokenId}
            selectedTargetCount={plusSelectedTargetIds.length}
            autoAdvanceDurationMs={PLUS_AUTO_ADVANCE_MS}
            autoAdvanceRemainingMs={plusAutoAdvanceRemainingMs}
            submitVisible={isPlusSubmitVisible}
            submitDisabled={isPlusSubmitDisabled}
            onStudyModeChange={handlePlusStudyModeChange}
            onWrongPoolClear={handleWrongPlusQuestionPoolClear}
            onModeChange={handlePlusModeChange}
            onTopicToggle={handlePlusTopicToggle}
            onTopicsClear={handlePlusTopicsClear}
            onPrimaryAction={handlePrimaryPlusAction}
            onTokenSelect={handlePlusTokenSelect}
            onSubmit={handlePlusSubmit}
            onClose={handlePlusClose}
          />
        ) : null}

        {activeTab === "harita" ? (
          <LayersSheet
            open={layersOpen}
            onOpenChange={setLayersOpen}
            physicalFeatures={physicalFeatures}
            economicFeatures={economicFeatures}
            activeTopics={activeTopics}
            activeCategories={activeCategories}
            activeEconomicTopics={activeEconomicTopics}
            activeEconomicCategories={activeEconomicCategories}
            onTopicToggle={handleTopicToggle}
            onCategoryToggle={handleCategoryToggle}
            onSelectAllTopics={handleSelectAllTopics}
            onClearAllTopics={handleClearAllTopics}
            onEconomicTopicToggle={handleEconomicTopicToggle}
            onEconomicCategoryToggle={handleEconomicCategoryToggle}
            onSelectAllEconomicTopics={handleSelectAllEconomicTopics}
            onClearAllEconomicTopics={handleClearAllEconomicTopics}
          />
        ) : null}

        {activeTab === "test" ? (
          <TestPanel
            questions={testQuestionsState.data}
            isLoading={testQuestionsState.isLoading}
            error={testQuestionsState.error}
            wrongIds={wrongTestQuestionIds}
            onAnswer={handleTestAnswer}
          />
        ) : null}

        {activeTab === "profil" ? (
          <ProfilePanel
            auth={auth}
            displayName={accountDisplayName}
            progress={progress}
            leaderboard={leaderboard}
            weakTopicRows={weakTopicRows}
            nextBadge={nextBadge}
            examDaysLeft={examDaysLeft}
            dailyXp={dailyXp.xp}
            dailyXpGoal={DAILY_XP_GOAL}
            onRefreshLeaderboard={refreshLeaderboard}
            onResetProgress={handleResetProgress}
            onWeakTopicPractice={handleWeakTopicPractice}
            onSetExamDate={handleSetExamDate}
            onSignOut={() => void auth.signOut()}
          />
        ) : null}

        <TabBar active={activeTab} onChange={handleTabChange} />

        <GamificationFX items={fxItems} onDismiss={dismissFx} />
    </div>
  );
}

export default App;
