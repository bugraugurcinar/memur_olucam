import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  economicFeatureCategories,
  economicFeatureTopics,
  getEconomicFeatureDisplayName,
  getEconomicLocationShortLabel,
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
import { geoJsonAttribution, geoJsonSources } from "./geojson/sources";
import { useGeoJson } from "./hooks/useGeoJson";
import { TurkeyMap, type ProvinceHighlight } from "./maps/TurkeyMap";
import { QUIZ_CORRECT_RADIUS_KM, formatDistanceKm, getDistanceKm } from "./quiz/geoUtils";
import {
  generatePlusQuestion,
  getPlusAvailability,
  getPlusPlacementCorrectness,
  getPlusTargetCorrectness,
  plusQuestionKindLabels,
  plusQuestionModeOptions,
  plusQuestionTopicOptions,
  type PlusPoint,
  type PlusQuestion,
  type PlusQuestionMode,
  type PlusQuestionTopic,
} from "./quiz/plusQuestionEngine";
import { buildProvinceQuizInfos } from "./quiz/provinceUtils";
import { isSupabaseConfigured } from "./lib/supabase";
import { useAuth, type UseAuthResult } from "./hooks/useAuth";
import { useQuizProgress } from "./hooks/useQuizProgress";
import { useLeaderboard } from "./hooks/useLeaderboard";
import { GamificationFX, buildFxItems, type FxItem } from "./components/GamificationFX";
import { Hud } from "./components/Hud";
import { TestPanel } from "./components/TestPanel";
import { useTestQuestions, type TestQuestionSource } from "./hooks/useTestQuestions";
import type { TestCategory } from "./quiz/testQuestions";
import { accuracyPercent, BADGES, PLUS_TOPIC_IDS, plusTopicLabel as getPlusTopicLabel } from "./quiz/gamification";

const PLUS_RECENT_QUESTION_HISTORY_LIMIT = 16;

const plusTopicChoices = plusQuestionTopicOptions.filter(
  (option): option is { id: Exclude<PlusQuestionTopic, "mixed">; label: string } => option.id !== "mixed",
);

const WRONG_PLUS_QUESTION_STORAGE_PREFIX = "kpss-cografya-atlas:wrong-plus-questions:";
const WRONG_TEST_QUESTION_STORAGE_PREFIX = "kpss-cografya-atlas:wrong-test-questions:";
// Test modu soru bankaları: her kaynak bir kategoriye (oyunlaştırma konusuna) karşılık gelir.
const TEST_QUESTION_SOURCES: TestQuestionSource[] = [
  { url: "/questions/tarih.json", category: "tarih" },
  { url: "/questions/vatandaslik.json", category: "vatandaslik" },
];
const PLUS_QUESTION_SEED_SEPARATOR = "__";

type PlusStudyMode = "all" | "wrong";

function plusQuestionSeedId(questionId: string) {
  return questionId.split(PLUS_QUESTION_SEED_SEPARATOR)[0];
}

function wrongPlusQuestionStorageKey(userId: string | null) {
  return `${WRONG_PLUS_QUESTION_STORAGE_PREFIX}${userId ?? "guest"}`;
}

function wrongTestQuestionStorageKey(userId: string | null) {
  return `${WRONG_TEST_QUESTION_STORAGE_PREFIX}${userId ?? "guest"}`;
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

function AccountForm({ auth }: { auth: UseAuthResult }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result =
      mode === "login"
        ? await auth.signIn(email.trim(), password)
        : await auth.signUp(email.trim(), password, username);
    if (result.error) {
      setFormError(result.error);
    }
    setSubmitting(false);
  };

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      {!isSupabaseConfigured ? (
        <p className="account-form__error">Hesap servisi yapılandırılmamış.</p>
      ) : null}
      {mode === "register" ? (
        <label>
          <span>Kullanıcı adı</span>
          <input
            autoComplete="username"
            maxLength={20}
            minLength={3}
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
        </label>
      ) : null}
      <label>
        <span>E-posta</span>
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label>
        <span>Parola</span>
        <input
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={6}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {formError ? <p className="account-form__error">{formError}</p> : null}
      <button className="quiz-launch-button" disabled={submitting || !isSupabaseConfigured} type="submit">
        {submitting ? "Lütfen bekle…" : mode === "login" ? "Giriş yap" : "Kayıt ol"}
      </button>
      <button
        className="account-form__toggle"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setFormError(null);
        }}
        type="button"
      >
        {mode === "login" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
      </button>
    </form>
  );
}

type PlusAnswerState = {
  isCorrect: boolean;
  message: string;
  detail: string;
  wrongTargetIds: string[];
  selectedTokenId: string | null;
};

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
  const [wrongPlusQuestionIds, setWrongPlusQuestionIds] = useState<string[]>(() =>
    readWrongPlusQuestionIds(wrongPlusQuestionStorageKey(null)),
  );
  const [appView, setAppView] = useState<"map" | "test">("map");
  const [wrongTestQuestionIds, setWrongTestQuestionIds] = useState<string[]>(() =>
    readWrongPlusQuestionIds(wrongTestQuestionStorageKey(null)),
  );
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
  const [fxItems, setFxItems] = useState<FxItem[]>([]);
  const [layersOpen, setLayersOpen] = useState(false);
  const dismissFx = useCallback(
    (id: number) => setFxItems((items) => items.filter((item) => item.id !== id)),
    [],
  );

  useEffect(() => {
    setWrongPlusQuestionIds(readWrongPlusQuestionIds(wrongPlusQuestionStorageKeyValue));
  }, [wrongPlusQuestionStorageKeyValue]);

  useEffect(() => {
    setWrongTestQuestionIds(readWrongPlusQuestionIds(wrongTestQuestionStorageKeyValue));
  }, [wrongTestQuestionStorageKeyValue]);

  const persistWrongPlusQuestionIds = useCallback(
    (getNextQuestionIds: (currentQuestionIds: string[]) => string[]) => {
      setWrongPlusQuestionIds((currentQuestionIds) => {
        const nextQuestionIds = normalizeWrongPlusQuestionIds(getNextQuestionIds(currentQuestionIds));

        writeWrongPlusQuestionIds(wrongPlusQuestionStorageKeyValue, nextQuestionIds);
        return nextQuestionIds;
      });
    },
    [wrongPlusQuestionStorageKeyValue],
  );

  const persistWrongTestQuestionIds = useCallback(
    (getNextQuestionIds: (currentQuestionIds: string[]) => string[]) => {
      setWrongTestQuestionIds((currentQuestionIds) => {
        const nextQuestionIds = normalizeWrongPlusQuestionIds(getNextQuestionIds(currentQuestionIds));

        writeWrongPlusQuestionIds(wrongTestQuestionStorageKeyValue, nextQuestionIds);
        return nextQuestionIds;
      });
    },
    [wrongTestQuestionStorageKeyValue],
  );

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
      persistWrongTestQuestionIds((currentQuestionIds) =>
        isCorrect
          ? currentQuestionIds.filter((id) => id !== questionId)
          : [questionId, ...currentQuestionIds.filter((id) => id !== questionId)],
      );

      const events = recordAnswer({ topic: category, isCorrect });
      const builtFx = buildFxItems(events);
      if (builtFx.length > 0) {
        setFxItems((items) => [...items, ...builtFx]);
      }
    },
    [persistWrongTestQuestionIds, recordAnswer],
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

  const provinceCount = provinces.data?.features.length ?? 0;
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
  const plusAvailability = useMemo(
    () =>
      getPlusAvailability(
        activePlusQuestionPool,
        plusTopics,
        plusMode,
        activeWrongPlusQuestionIds,
        provinceQuizInfos,
      ),
    [activePlusQuestionPool, activeWrongPlusQuestionIds, plusMode, plusTopics, provinceQuizInfos],
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
  const selectedText = useMemo(
    () => selectedProvinceName ?? "Henüz seçilmedi",
    [selectedProvinceName],
  );

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
  }, [activePlusQuestionPool, activeWrongPlusQuestionIds, plusMode, plusTopics, provinceQuizInfos]);

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

    persistWrongPlusQuestionIds(() => []);
    if (plusStudyMode === "wrong") {
      resetPlusQuestionState();
      setMapGuesses([]);
    }
  }, [persistWrongPlusQuestionIds, plusStudyMode, resetPlusQuestionState]);

  const handlePlusTopicToggle = useCallback(
    (topic: Exclude<PlusQuestionTopic, "mixed">) => {
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
      persistWrongPlusQuestionIds((currentQuestionIds) =>
        isCorrect
          ? currentQuestionIds.filter((questionId) => questionId !== currentQuestionSeedId)
          : [currentQuestionSeedId, ...currentQuestionIds.filter((questionId) => questionId !== currentQuestionSeedId)],
      );
      setPlusAnswer({ isCorrect, message, detail, wrongTargetIds, selectedTokenId });
      setPlusSelectedTokenId(null);

      const events = recordAnswer({ topic: currentPlusQuestion.topic, isCorrect });
      const builtFx = buildFxItems(events);
      if (builtFx.length > 0) {
        setFxItems((items) => [...items, ...builtFx]);
      }
    },
    [currentPlusQuestion, persistWrongPlusQuestionIds, plusAnswer, recordAnswer],
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

  const handlePlusTargetDrop = useCallback(
    (targetId: string, tokenId: string) => {
      assignPlusTokenToTarget(targetId, tokenId);
    },
    [assignPlusTokenToTarget],
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

      if (!target) {
        return;
      }

      const distanceKm = getDistanceKm(guess, target.point);
      const isCorrect = distanceKm <= QUIZ_CORRECT_RADIUS_KM;

      setMapGuesses([guess]);
      setSelectedProvinceName(null);
      setSelectedFeature(null);
      setSelectedEconomicFeature(null);
      finalizePlusAnswer({
        isCorrect,
        message: isCorrect ? "Doğru." : "Yanlış.",
        detail: isCorrect
          ? `${formatDistanceKm(distanceKm)} km uzaklıkta işaretledin.`
          : `${formatDistanceKm(distanceKm)} km uzaktasın. Doğru nokta haritada gösterildi.`,
        wrongTargetIds: [],
        selectedTokenId: null,
      });
    },
    [currentPlusQuestion, finalizePlusAnswer, plusAnswer],
  );

  const plusResultStatus = plusAnswer ? (plusAnswer.isCorrect ? "correct" : "wrong") : null;
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
  const isPlusMapLocateQuestion = currentPlusQuestion?.kind === "mapLocate";
  const isPlusMapLocateActive = Boolean(isPlusMapLocateQuestion && !plusAnswer);
  const plusMapLocateTarget = isPlusMapLocateQuestion ? currentPlusQuestion?.targets[0] ?? null : null;
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
  const plusVisibleSelectedTargetIds =
    currentPlusQuestion?.kind === "placement" ? Object.keys(plusAssignments) : plusSelectedTargetIds;
  const plusCorrectTargetIds = plusAnswer ? currentPlusQuestion?.correctTargetIds ?? [] : [];
  const plusWrongTargetIds = plusAnswer?.wrongTargetIds ?? [];
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
  return (
    <div className="app-shell">
        <div className="view-switch glass" role="group" aria-label="Görünüm">
          <button
            className={appView === "map" ? "is-active" : ""}
            onClick={() => setAppView("map")}
            type="button"
          >
            Harita
          </button>
          <button
            className={appView === "test" ? "is-active" : ""}
            onClick={() => setAppView("test")}
            type="button"
          >
            Test
          </button>
        </div>

        {appView === "map" ? (
        <section className="map-stage">
          <TurkeyMap
            countryData={country.data}
            provincesData={provinces.data}
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
            plusGuessPoints={mapGuesses}
            plusMapLocateTargetName={plusMapLocateTarget?.name ?? "Soru"}
            plusMapLocateTargetPoint={plusMapLocateTarget?.point ?? null}
            plusMapLocateShowTargetPoint={plusMapLocateTarget ? Boolean(plusAnswer) : false}
            plusTargets={isPlusMapLocateQuestion ? [] : currentPlusQuestion?.targets ?? []}
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
            onPlusTargetDrop={handlePlusTargetDrop}
          />

          {(isLoading || error) && (
            <div className="map-state glass" role="status">
              <strong>{error ? "Harita verisi yüklenemedi" : "Harita hazırlanıyor"}</strong>
              <span>{error ?? "Türkiye, il sınırları, fiziki ve ekonomik GeoJSON katmanları yükleniyor."}</span>
            </div>
          )}
        </section>
        ) : null}

        <Hud
          loading={auth.loading}
          isLoggedIn={Boolean(auth.user)}
          displayName={accountDisplayName}
          email={auth.user?.email}
          level={progress.level.level}
          levelProgress={progress.level.progress}
          intoLevel={progress.level.intoLevel}
          span={progress.level.span}
          totalXp={progress.xp}
          streak={progress.daily.dailyStreak}
          sessionCorrect={progress.session.correct}
          sessionAnswered={progress.session.answered}
          onSignOut={() => void auth.signOut()}
          canReset={Boolean(auth.user) && progress.totals.answered > 0}
          onReset={handleResetProgress}
          accountForm={<AccountForm auth={auth} />}
        />

        {appView === "map" ? (
          <>
        <div className="quiz-dock glass">
          <div className="panel-section plus-panel">
            <div className="quiz-section-heading">
              <h2>Soru+</h2>
              <span>{plusAvailabilityLabel}</span>
            </div>

            <div className="plus-study-mode" aria-label="Soru+ çalışma modu">
              <button
                aria-pressed={plusStudyMode === "all"}
                onClick={() => handlePlusStudyModeChange("all")}
                type="button"
              >
                Tüm sorular
              </button>
              <button
                aria-pressed={plusStudyMode === "wrong"}
                disabled={wrongPlusQuestionCount === 0}
                onClick={() => handlePlusStudyModeChange("wrong")}
                type="button"
              >
                Yanlışları çalış
                <small>{wrongPlusQuestionCount}</small>
              </button>
            </div>

            {plusStudyMode === "wrong" ? (
              <div className="wrong-question-pool" role="status">
                <div>
                  <strong>Yanlış havuzu</strong>
                  <span>{wrongPlusQuestionStatus}</span>
                </div>
                {wrongPlusQuestionCount > 0 ? (
                  <button onClick={handleWrongPlusQuestionPoolClear} type="button">
                    Temizle
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="quiz-control-grid" aria-label="Soru+ seçenekleri">
              <label>
                <span>Soru Tipi</span>
                <select value={plusMode} onChange={(event) => handlePlusModeChange(event.target.value as PlusQuestionMode)}>
                  {plusQuestionModeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="plus-topic-select" aria-label="Soru+ konuları">
              <div className="plus-topic-select__heading">
                <span>Konular</span>
                <span className="plus-topic-select__hint">
                  {plusTopics.length === 0 ? "Tümü seçili" : `${plusTopics.length} konu`}
                </span>
              </div>
              <div className="plus-topic-chip-list">
                <button
                  aria-pressed={plusTopics.length === 0}
                  className="category-chip"
                  onClick={handlePlusTopicsClear}
                  type="button"
                >
                  Tümü
                </button>
                {plusTopicChoices.map((option) => {
                  const isActive = plusTopics.includes(option.id);
                  const count = plusAvailability.byTopic[option.id];

                  return (
                    <button
                      aria-pressed={isActive}
                      className="category-chip"
                      disabled={count === 0}
                      key={option.id}
                      onClick={() => handlePlusTopicToggle(option.id)}
                      type="button"
                    >
                      {option.label}
                      <small>{count}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              className={`quiz-launch-button plus-launch-button${isPlusActive ? " quiz-launch-button--active" : ""}`}
              disabled={!canStartPlus}
              onClick={handlePrimaryPlusAction}
              type="button"
            >
              {currentPlusQuestion && plusAnswer ? "Yeni Soru+"
                : currentPlusQuestion
                  ? "Soru+ yenile"
                  : "Soru+ başlat"}
            </button>

            {progress.session.answered > 0 ? (
              <div className="plus-session-strip" role="status">
                <span>
                  {progress.session.correct}/{progress.session.answered} doğru
                </span>
                <span>Seri: {progress.session.currentStreak}</span>
              </div>
            ) : null}

            {currentPlusQuestion ? (
            <div
              key={currentPlusQuestion.id}
              className={`quiz-card plus-card${plusAnswer ? (plusAnswer.isCorrect ? " quiz-card--correct" : " quiz-card--wrong") : ""}`}
            >
              <span className="quiz-card__eyebrow">
                {currentPlusQuestion.title} · {plusQuestionKindLabels[currentPlusQuestion.kind]}
              </span>
              <strong>{currentPlusQuestion.prompt}</strong>
              <p>{plusAnswer ? plusAnswer.message : currentPlusQuestion.helper}</p>

              {currentPlusQuestion?.kind === "placement" ||
              currentPlusQuestion?.kind === "choice" ||
              currentPlusQuestion?.kind === "mapMatch" ? (
                <div className="plus-token-list" aria-label="Soru+ etiketleri">
                  {currentPlusQuestion.tokens.map((token) => {
                    const isSelected = plusSelectedTokenId === token.id || plusAnswer?.selectedTokenId === token.id;
                    const isCorrectToken = plusAnswer && token.id === currentPlusQuestion.correctTokenId;
                    const isWrongToken =
                      plusAnswer?.selectedTokenId === token.id && token.id !== currentPlusQuestion.correctTokenId;
                    const className = [
                      "plus-token",
                      isSelected ? "plus-token--selected" : "",
                      isCorrectToken ? "plus-token--correct" : "",
                      isWrongToken ? "plus-token--wrong" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <button
                        className={className}
                        disabled={Boolean(plusAnswer)}
                        draggable={currentPlusQuestion.kind === "placement" && !plusAnswer}
                        key={token.id}
                        onClick={() => handlePlusTokenSelect(token.id)}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", token.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        style={{ "--plus-token-color": token.color } as CSSProperties}
                        type="button"
                      >
                        <span>{token.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {currentPlusQuestion?.kind === "mapLocate" && !plusAnswer ? (
                <div className="quiz-map-hint">
                  <span>{QUIZ_CORRECT_RADIUS_KM} km</span>
                  <strong>Haritada tahmin noktanı bırak</strong>
                </div>
              ) : null}

              {currentPlusQuestion?.kind === "placement" ? (
                <div className="plus-target-list" aria-label="Soru+ yerleştirme durumu">
                  {currentPlusQuestion.targets.map((target) => {
                    const assignedToken = plusTokenById.get(plusAssignments[target.id]);
                    const isWrong = plusWrongTargetIds.includes(target.id);
                    const isCorrect = plusAnswer && !isWrong;

                    return (
                      <div
                        className={`plus-target-row${isCorrect ? " plus-target-row--correct" : ""}${isWrong ? " plus-target-row--wrong" : ""}`}
                        key={target.id}
                      >
                        <strong>{target.label}</strong>
                        <span>{assignedToken?.label ?? "Boş"}</span>
                        {plusAnswer ? <small>{target.name}</small> : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {currentPlusQuestion?.kind === "pickMany" ? (
                <div className="quiz-map-hint">
                  <span>{plusSelectedTargetIds.length} seçili</span>
                  <strong>Doğru noktaların tamamını işaretle</strong>
                </div>
              ) : null}

              {plusAnswer ? (
                <div className="quiz-result">
                  <strong>{plusAnswer.isCorrect ? "Doğru" : "Yanlış"}</strong>
                  <span>{plusAnswer.detail}</span>
                </div>
              ) : null}

              {plusAnswer && currentPlusQuestion ? (
                <p className="quiz-note">{currentPlusQuestion.kpssNote}</p>
              ) : null}

              {currentPlusQuestion ? (
                <div className="quiz-actions plus-actions">
                  {isPlusSubmitVisible ? (
                    <button disabled={isPlusSubmitDisabled} onClick={handlePlusSubmit} type="button">
                      {currentPlusQuestion.submitLabel}
                    </button>
                  ) : null}
                  <button className="quiz-actions__secondary" onClick={handlePlusClose} type="button">
                    Soru+ kapat
                  </button>
                </div>
              ) : null}
            </div>
            ) : null}
          </div>

          {!isPlusActive ? (
            <>
              {auth.user ? (
                <div className="panel-section dock-leaderboard">
                  <div className="quiz-section-heading">
                    <h2>Sıralama</h2>
                    <button className="account-form__toggle" onClick={refreshLeaderboard} type="button">
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
                        <div
                          className={`leaderboard-row${entry.isMe ? " leaderboard-row--me" : ""}`}
                          key={entry.id}
                        >
                          <span className="leaderboard-row__rank">{entry.rank}</span>
                          <span className="leaderboard-row__name">{entry.username}</span>
                          <small>{entry.xp} XP</small>
                        </div>
                      ))}
                      {leaderboard.myRank &&
                      !leaderboard.entries.slice(0, 5).some((entry) => entry.isMe) ? (
                        <>
                          <div className="leaderboard__divider" aria-hidden="true" />
                          <div className="leaderboard-row leaderboard-row--me">
                            <span className="leaderboard-row__rank">{leaderboard.myRank}</span>
                            <span className="leaderboard-row__name">{accountDisplayName}</span>
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
                  {auth.user && progress.totals.answered > 0 ? (
                    <button className="account-form__toggle" onClick={handleResetProgress} type="button">
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
                          <div className="progress-topic-row" key={row.id}>
                            <span className="progress-topic-row__label">{row.label}</span>
                            <div className="progress-bar">
                              <div className="progress-bar__fill" style={{ width: `${accuracy}%` }} />
                            </div>
                            <small>
                              {row.stat.correct}/{row.stat.answered}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {!auth.user && !auth.loading ? (
                <div className="panel-section">
                  <p className="progress-empty">
                    Giriş yap; XP kazan, rozet topla ve liderlik tablosuna gir. 🚀
                  </p>
                </div>
              ) : null}

              {auth.user ? (
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
                          <div
                            className={`daily-quest${quest.done ? " daily-quest--done" : ""}`}
                            key={quest.id}
                          >
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
                          <div className="badge" key={badge.id} title={badge.description}>
                            <span className="badge__icon">{badge.icon}</span>
                            <small>{badge.label}</small>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </div>

        <div className={`layers-control${layersOpen ? " layers-control--open" : ""}`}>
          <button
            className="layers-toggle glass"
            onClick={() => setLayersOpen((value) => !value)}
            aria-expanded={layersOpen}
            type="button"
          >
            🗺️ Katmanlar
          </button>
          {layersOpen ? (
            <div className="layers-panel glass">
          <div className="panel-section">
            <h2>Fiziki konular</h2>
            <div className="topic-filter-toolbar">
              <button onClick={handleSelectAllTopics} type="button">
                Tümünü göster
              </button>
              <button onClick={handleClearAllTopics} type="button">
                Tümünü gizle
              </button>
            </div>
            <div className="topic-filter-list" aria-label="Fiziki konular">
              {physicalFeatureTopics.map((topic) => {
                const isActive = activeTopics.includes(topic.id);
                const topicCount = physicalFeatures.filter((feature) => feature.properties.topic === topic.id).length;
                const topicCategories = physicalFeatureCategories.filter((category) => category.topic === topic.id);

                return (
                  <div className="topic-filter-group" key={topic.id}>
                    <button
                      aria-pressed={isActive}
                      className="topic-chip"
                      onClick={() => handleTopicToggle(topic.id)}
                      type="button"
                    >
                      <span className="topic-chip__swatch" style={{ backgroundColor: topic.color }} />
                      <span className="topic-chip__label">{topic.label}</span>
                      <small>{topicCount}</small>
                    </button>

                    <div className="category-chip-list" aria-label={`${topic.label} kategorileri`}>
                      {topicCategories.map((category) => {
                        const isCategoryActive = activeCategories.includes(category.id);
                        const categoryCount = physicalFeatures.filter(
                          (feature) => feature.properties.category === category.id,
                        ).length;

                        return (
                          <button
                            aria-pressed={isCategoryActive}
                            className="category-chip"
                            key={category.id}
                            onClick={() => handleCategoryToggle(category.id)}
                            style={
                              isCategoryActive
                                ? { backgroundColor: category.color, borderColor: category.color }
                                : undefined
                            }
                            type="button"
                          >
                            {category.label}
                            <small>{categoryCount}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel-section">
            <h2>Ekonomik konular</h2>
            <div className="topic-filter-toolbar">
              <button onClick={handleSelectAllEconomicTopics} type="button">
                Tümünü göster
              </button>
              <button onClick={handleClearAllEconomicTopics} type="button">
                Tümünü gizle
              </button>
            </div>
            <div className="topic-filter-list" aria-label="Ekonomik konular">
              {economicFeatureTopics.map((topic) => {
                const isActive = activeEconomicTopics.includes(topic.id);
                const topicCount = economicFeatures.filter((feature) => feature.properties.topic === topic.id).length;
                const topicCategories = economicFeatureCategories.filter((category) => category.topic === topic.id);

                return (
                  <div className="topic-filter-group" key={topic.id}>
                    <button
                      aria-pressed={isActive}
                      className="topic-chip"
                      onClick={() => handleEconomicTopicToggle(topic.id)}
                      type="button"
                    >
                      <span className="topic-chip__swatch" style={{ backgroundColor: topic.color }} />
                      <span className="topic-chip__label">{topic.label}</span>
                      <small>{topicCount}</small>
                    </button>

                    <div className="category-chip-list" aria-label={`${topic.label} kategorileri`}>
                      {topicCategories.map((category) => {
                        const isCategoryActive = activeEconomicCategories.includes(category.id);
                        const categoryCount = economicFeatures.filter(
                          (feature) => feature.properties.category === category.id,
                        ).length;

                        return (
                          <button
                            aria-pressed={isCategoryActive}
                            className="category-chip"
                            key={category.id}
                            onClick={() => handleEconomicCategoryToggle(category.id)}
                            style={
                              isCategoryActive
                                ? { backgroundColor: category.color, borderColor: category.color }
                                : undefined
                            }
                            type="button"
                          >
                            {category.label}
                            <small>{categoryCount}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="attribution">{geoJsonAttribution}</p>
            </div>
          ) : null}
        </div>
          </>
        ) : (
          <TestPanel
            questions={testQuestionsState.data}
            isLoading={testQuestionsState.isLoading}
            error={testQuestionsState.error}
            wrongIds={wrongTestQuestionIds}
            onAnswer={handleTestAnswer}
          />
        )}

        <GamificationFX items={fxItems} onDismiss={dismissFx} />
    </div>
  );
}

export default App;
