import { useCallback, useEffect, useMemo, useState } from "react";
import { LayerStatus } from "./components/LayerStatus";
import {
  economicFeatureCategories,
  economicFeatureTopics,
  getEconomicFeatureCategory,
  getEconomicFeatureDisplayName,
  getEconomicLocationShortLabel,
  getEconomicFeatures,
  type EconomicFeatureCategory,
  type EconomicFeatureProperties,
  type EconomicFeatureTopic,
} from "./geojson/economicFeatures";
import {
  getPhysicalFeatureCategory,
  getPhysicalFeatures,
  physicalFeatureCategories,
  physicalFeatureTopics,
  type PhysicalFeatureCategory,
  type PhysicalFeatureProperties,
  type PhysicalFeatureTopic,
} from "./geojson/physicalFeatures";
import { geoJsonAttribution, geoJsonSources } from "./geojson/sources";
import { useGeoJson } from "./hooks/useGeoJson";
import { TurkeyMap } from "./maps/TurkeyMap";
import {
  QUIZ_CORRECT_RADIUS_KM,
  TIMED_ROUND_SECONDS,
  TIMED_ROUND_TARGET,
  filterFeaturesByRegion,
  formatDistanceKm,
  generateQuizQuestion,
  getChoiceCorrectness,
  getDistanceKm,
  getHeatLabel,
  getRegionOptions,
  quizDifficultyOptions,
  quizModeOptions,
  quizRoundModeOptions,
  type QuizDifficulty,
  type QuizMode,
  type QuizPoint,
  type QuizQuestion,
  type QuizRoundMode,
  type QuizSessionStats,
} from "./quiz/questionEngine";

type QuizAnswerState = {
  isCorrect: boolean;
  isFinal: boolean;
  message: string;
  detail: string;
  selectedChoiceId: string | null;
  distanceKm: number | null;
  heatLabel: string | null;
};

const questionKindLabels: Record<QuizQuestion["kind"], string> = {
  mapLocate: "Haritada bul",
  reverseMapIdentify: "Ters harita",
  categoryChoice: "Kategori",
  locationMatch: "Merkez eşleştir",
  featureFromLocation: "Unsuru bul",
  notInCategory: "Değildir",
  trueFalse: "Doğru / yanlış",
  iIiI: "I-II-III",
  bestExplanation: "Açıklama",
  nearbyConcept: "Yakın kavram",
  similarDisambiguation: "Benzerleri ayırt et",
};

const difficultyLabels: Record<QuizDifficulty, string> = {
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
};

const emptyStats: QuizSessionStats = {
  answered: 0,
  correct: 0,
  wrong: 0,
  targetCount: TIMED_ROUND_TARGET,
  timeLeft: TIMED_ROUND_SECONDS,
  isComplete: false,
};

function loadMistakeLedger() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const value = window.localStorage.getItem("kpss-atlas-mistakes");
    return value ? (JSON.parse(value) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function App() {
  const [selectedProvinceName, setSelectedProvinceName] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<PhysicalFeatureProperties | null>(null);
  const [selectedEconomicFeature, setSelectedEconomicFeature] =
    useState<EconomicFeatureProperties | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<QuizAnswerState | null>(null);
  const [mapGuesses, setMapGuesses] = useState<QuizPoint[]>([]);
  const [quizMode, setQuizMode] = useState<QuizMode>("mixed");
  const [quizDifficulty, setQuizDifficulty] = useState<QuizDifficulty>("medium");
  const [quizRoundMode, setQuizRoundMode] = useState<QuizRoundMode>("free");
  const [quizRegion, setQuizRegion] = useState("all");
  const [sessionStats, setSessionStats] = useState<QuizSessionStats>(emptyStats);
  const [mistakeLedger, setMistakeLedger] = useState<Record<string, number>>(loadMistakeLedger);
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
  const [expandedTopics, setExpandedTopics] = useState<PhysicalFeatureTopic[]>(["mountain"]);
  const [expandedEconomicTopics, setExpandedEconomicTopics] = useState<EconomicFeatureTopic[]>([
    "agriculture",
  ]);
  const [expandedQuizTopics, setExpandedQuizTopics] = useState<PhysicalFeatureTopic[]>(["mountain"]);
  const [expandedQuizEconomicTopics, setExpandedQuizEconomicTopics] = useState<EconomicFeatureTopic[]>([
    "agriculture",
  ]);
  const country = useGeoJson(geoJsonSources.country.url);
  const provinces = useGeoJson(geoJsonSources.provinces.url);
  const physicalFeaturesData = useGeoJson(geoJsonSources.physicalFeatures.url);
  const economicFeaturesData = useGeoJson(geoJsonSources.economicFeatures.url);

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
  const regionOptions = useMemo(() => getRegionOptions(quizQuestionPool), [quizQuestionPool]);
  const regionalQuestionPool = useMemo(
    () => filterFeaturesByRegion(quizQuestionPool, quizRegion),
    [quizQuestionPool, quizRegion],
  );
  const reviewFeatureIds = useMemo(
    () => Object.entries(mistakeLedger).filter(([, weight]) => weight > 0).map(([id]) => id),
    [mistakeLedger],
  );
  const isLoading =
    country.isLoading || provinces.isLoading || physicalFeaturesData.isLoading || economicFeaturesData.isLoading;
  const error = country.error ?? provinces.error ?? physicalFeaturesData.error ?? economicFeaturesData.error;
  const shouldUsePhysicalCategoryColors = activeTopics.length === 1;
  const shouldUseEconomicCategoryColors = activeEconomicTopics.length === 1;
  const canStartQuiz =
    regionalQuestionPool.length > 0 && !physicalFeaturesData.isLoading && !economicFeaturesData.isLoading;
  const isQuizActive = Boolean(currentQuestion) && !sessionStats.isComplete;
  const activePhysicalQuizCategoryCount = physicalFeatureCategories.filter(
    (category) => activeTopics.includes(category.topic) && activeCategories.includes(category.id),
  ).length;
  const activeEconomicQuizCategoryCount = economicFeatureCategories.filter(
    (category) =>
      activeEconomicTopics.includes(category.topic) && activeEconomicCategories.includes(category.id),
  ).length;
  const selectedText = useMemo(
    () => selectedProvinceName ?? "Henüz seçilmedi",
    [selectedProvinceName],
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kpss-atlas-mistakes", JSON.stringify(mistakeLedger));
    }
  }, [mistakeLedger]);

  useEffect(() => {
    if (quizRoundMode !== "timed" || !isQuizActive) {
      return;
    }

    const timer = window.setInterval(() => {
      setSessionStats((currentStats) => {
        if (currentStats.timeLeft <= 1) {
          return { ...currentStats, timeLeft: 0, isComplete: true };
        }

        return { ...currentStats, timeLeft: currentStats.timeLeft - 1 };
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isQuizActive, quizRoundMode]);

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
    if (currentQuestion && !regionalQuestionPool.some((feature) => feature.properties.id === currentQuestion.targetFeature.properties.id)) {
      setCurrentQuestion(null);
      setQuizAnswer(null);
      setMapGuesses([]);
    }
  }, [currentQuestion, regionalQuestionPool]);

  useEffect(() => {
    if (quizRegion !== "all" && !regionOptions.includes(quizRegion)) {
      setQuizRegion("all");
    }
  }, [quizRegion, regionOptions]);

  const rememberMistake = useCallback((featureId: string) => {
    setMistakeLedger((currentLedger) => ({
      ...currentLedger,
      [featureId]: Math.min((currentLedger[featureId] ?? 0) + 1, 5),
    }));
  }, []);

  const forgiveMistake = useCallback((featureId: string) => {
    setMistakeLedger((currentLedger) => {
      const nextWeight = (currentLedger[featureId] ?? 0) - 1;

      if (nextWeight > 0) {
        return { ...currentLedger, [featureId]: nextWeight };
      }

      const { [featureId]: _removed, ...rest } = currentLedger;
      return rest;
    });
  }, []);

  const updateStats = useCallback(
    (isCorrect: boolean) => {
      setSessionStats((currentStats) => {
        const answered = currentStats.answered + 1;
        const nextStats = {
          ...currentStats,
          answered,
          correct: currentStats.correct + (isCorrect ? 1 : 0),
          wrong: currentStats.wrong + (isCorrect ? 0 : 1),
        };

        if (quizRoundMode === "timed" && answered >= currentStats.targetCount) {
          return { ...nextStats, isComplete: true };
        }

        return nextStats;
      });
    },
    [quizRoundMode],
  );

  const finalizeAnswer = useCallback(
    ({
      isCorrect,
      message,
      detail,
      selectedChoiceId,
      distanceKm,
      heatLabel,
    }: {
      isCorrect: boolean;
      message: string;
      detail: string;
      selectedChoiceId: string | null;
      distanceKm: number | null;
      heatLabel: string | null;
    }) => {
      if (!currentQuestion || quizAnswer?.isFinal) {
        return;
      }

      setQuizAnswer({
        isCorrect,
        isFinal: true,
        message,
        detail,
        selectedChoiceId,
        distanceKm,
        heatLabel,
      });
      updateStats(isCorrect);

      if (isCorrect) {
        forgiveMistake(currentQuestion.targetFeature.properties.id);
      } else {
        rememberMistake(currentQuestion.targetFeature.properties.id);
      }
    },
    [currentQuestion, forgiveMistake, quizAnswer?.isFinal, rememberMistake, updateStats],
  );

  const startNextQuestion = useCallback(
    (shouldResetSession = false) => {
      const nextQuestion = generateQuizQuestion({
        features: regionalQuestionPool,
        mode: quizMode,
        difficulty: quizDifficulty,
        previousQuestionId: currentQuestion?.id ?? null,
        reviewFeatureIds,
      });

      if (!nextQuestion) {
        return;
      }

      if (shouldResetSession || sessionStats.isComplete) {
        setSessionStats({
          ...emptyStats,
          timeLeft: quizRoundMode === "timed" ? TIMED_ROUND_SECONDS : emptyStats.timeLeft,
        });
      }

      setCurrentQuestion(nextQuestion);
      setQuizAnswer(null);
      setMapGuesses([]);
      setSelectedProvinceName(null);
      setSelectedFeature(null);
      setSelectedEconomicFeature(null);
    },
    [
      currentQuestion?.id,
      quizDifficulty,
      quizMode,
      quizRoundMode,
      regionalQuestionPool,
      reviewFeatureIds,
      sessionStats.isComplete,
    ],
  );

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

  const handleTopicToggle = useCallback((topicId: PhysicalFeatureTopic) => {
    setExpandedTopics((currentTopics) =>
      currentTopics.includes(topicId) ? currentTopics : [...currentTopics, topicId],
    );
    setActiveTopics((currentTopics) =>
      currentTopics.includes(topicId)
        ? currentTopics.filter((currentTopic) => currentTopic !== topicId)
        : [...currentTopics, topicId],
    );
  }, []);

  const handleTopicExpansionToggle = useCallback((topicId: PhysicalFeatureTopic) => {
    setExpandedTopics((currentTopics) =>
      currentTopics.includes(topicId)
        ? currentTopics.filter((currentTopic) => currentTopic !== topicId)
        : [...currentTopics, topicId],
    );
  }, []);

  const handleCategoryToggle = useCallback((categoryId: PhysicalFeatureCategory) => {
    setActiveCategories((currentCategories) =>
      currentCategories.includes(categoryId)
        ? currentCategories.filter((currentCategory) => currentCategory !== categoryId)
        : [...currentCategories, categoryId],
    );
  }, []);

  const handleEconomicTopicToggle = useCallback((topicId: EconomicFeatureTopic) => {
    setExpandedEconomicTopics((currentTopics) =>
      currentTopics.includes(topicId) ? currentTopics : [...currentTopics, topicId],
    );
    setActiveEconomicTopics((currentTopics) =>
      currentTopics.includes(topicId)
        ? currentTopics.filter((currentTopic) => currentTopic !== topicId)
        : [...currentTopics, topicId],
    );
  }, []);

  const handleEconomicTopicExpansionToggle = useCallback((topicId: EconomicFeatureTopic) => {
    setExpandedEconomicTopics((currentTopics) =>
      currentTopics.includes(topicId)
        ? currentTopics.filter((currentTopic) => currentTopic !== topicId)
        : [...currentTopics, topicId],
    );
  }, []);

  const handleEconomicCategoryToggle = useCallback((categoryId: EconomicFeatureCategory) => {
    setActiveEconomicCategories((currentCategories) =>
      currentCategories.includes(categoryId)
        ? currentCategories.filter((currentCategory) => currentCategory !== categoryId)
        : [...currentCategories, categoryId],
    );
  }, []);

  const handleQuizTopicToggle = useCallback((topicId: PhysicalFeatureTopic) => {
    setActiveTopics((currentTopics) =>
      currentTopics.includes(topicId)
        ? currentTopics.filter((currentTopic) => currentTopic !== topicId)
        : [...currentTopics, topicId],
    );
  }, []);

  const handleQuizTopicExpansionToggle = useCallback((topicId: PhysicalFeatureTopic) => {
    setExpandedQuizTopics((currentTopics) =>
      currentTopics.includes(topicId)
        ? currentTopics.filter((currentTopic) => currentTopic !== topicId)
        : [...currentTopics, topicId],
    );
  }, []);

  const handleQuizCategoryToggle = useCallback((categoryId: PhysicalFeatureCategory) => {
    const category = getPhysicalFeatureCategory(categoryId);

    setActiveCategories((currentCategories) =>
      currentCategories.includes(categoryId)
        ? currentCategories.filter((currentCategory) => currentCategory !== categoryId)
        : [...currentCategories, categoryId],
    );
    setActiveTopics((currentTopics) =>
      currentTopics.includes(category.topic) ? currentTopics : [...currentTopics, category.topic],
    );
  }, []);

  const handleQuizEconomicTopicToggle = useCallback((topicId: EconomicFeatureTopic) => {
    setActiveEconomicTopics((currentTopics) =>
      currentTopics.includes(topicId)
        ? currentTopics.filter((currentTopic) => currentTopic !== topicId)
        : [...currentTopics, topicId],
    );
  }, []);

  const handleQuizEconomicTopicExpansionToggle = useCallback((topicId: EconomicFeatureTopic) => {
    setExpandedQuizEconomicTopics((currentTopics) =>
      currentTopics.includes(topicId)
        ? currentTopics.filter((currentTopic) => currentTopic !== topicId)
        : [...currentTopics, topicId],
    );
  }, []);

  const handleQuizEconomicCategoryToggle = useCallback((categoryId: EconomicFeatureCategory) => {
    const category = getEconomicFeatureCategory(categoryId);

    setActiveEconomicCategories((currentCategories) =>
      currentCategories.includes(categoryId)
        ? currentCategories.filter((currentCategory) => currentCategory !== categoryId)
        : [...currentCategories, categoryId],
    );
    setActiveEconomicTopics((currentTopics) =>
      currentTopics.includes(category.topic) ? currentTopics : [...currentTopics, category.topic],
    );
  }, []);

  const handleQuizClose = useCallback(() => {
    setCurrentQuestion(null);
    setQuizAnswer(null);
    setMapGuesses([]);
    setSessionStats((currentStats) => ({ ...currentStats, isComplete: false }));
  }, []);

  const handleChoiceAnswer = useCallback(
    (choiceId: string) => {
      if (!currentQuestion || currentQuestion.requiresMapAnswer || quizAnswer?.isFinal) {
        return;
      }

      const isCorrect = getChoiceCorrectness(currentQuestion, choiceId);
      const choice = currentQuestion.choices.find((item) => item.id === choiceId);

      finalizeAnswer({
        isCorrect,
        message: isCorrect ? "Doğru." : "Yanlış.",
        detail: isCorrect
          ? currentQuestion.answerSummary
          : `Doğru cevap: ${currentQuestion.expectedLabel}. ${currentQuestion.answerSummary}`,
        selectedChoiceId: choice?.id ?? choiceId,
        distanceKm: null,
        heatLabel: null,
      });
    },
    [currentQuestion, finalizeAnswer, quizAnswer?.isFinal],
  );

  const handleQuizGuess = useCallback(
    (guess: QuizPoint) => {
      if (!currentQuestion || !currentQuestion.requiresMapAnswer || quizAnswer?.isFinal) {
        return;
      }

      const distanceKm = getDistanceKm(guess, currentQuestion.targetPoint);
      const heatLabel = getHeatLabel(distanceKm);
      const nextGuesses = [...mapGuesses, guess];
      const isCorrect = distanceKm <= QUIZ_CORRECT_RADIUS_KM;
      const maxAttempts = currentQuestion.allowsSecondAttempt ? 2 : 1;

      setMapGuesses(nextGuesses);
      setSelectedProvinceName(null);
      setSelectedFeature(null);
      setSelectedEconomicFeature(null);

      if (isCorrect) {
        finalizeAnswer({
          isCorrect: true,
          message: "Doğru.",
          detail: `${formatDistanceKm(distanceKm)} km uzaklıkta işaretledin.`,
          selectedChoiceId: null,
          distanceKm,
          heatLabel,
        });
        return;
      }

      if (nextGuesses.length < maxAttempts) {
        setQuizAnswer({
          isCorrect: false,
          isFinal: false,
          message: `${heatLabel}. Bir hakkın daha var.`,
          detail: `${formatDistanceKm(distanceKm)} km uzaktasın; tahminini daralt.`,
          selectedChoiceId: null,
          distanceKm,
          heatLabel,
        });
        return;
      }

      finalizeAnswer({
        isCorrect: false,
        message: "Yanlış.",
        detail: `${formatDistanceKm(distanceKm)} km uzaktasın. Doğru nokta haritada gösterildi.`,
        selectedChoiceId: null,
        distanceKm,
        heatLabel,
      });
    },
    [currentQuestion, finalizeAnswer, mapGuesses, quizAnswer?.isFinal],
  );

  const handlePrimaryQuizAction = useCallback(() => {
    if (!canStartQuiz) {
      return;
    }

    startNextQuestion(!currentQuestion || sessionStats.isComplete);
  }, [canStartQuiz, currentQuestion, sessionStats.isComplete, startNextQuestion]);

  const handleModeChange = useCallback((mode: QuizMode) => {
    setQuizMode(mode);
    setCurrentQuestion(null);
    setQuizAnswer(null);
    setMapGuesses([]);
  }, []);

  const handleRoundModeChange = useCallback((mode: QuizRoundMode) => {
    setQuizRoundMode(mode);
    setSessionStats({ ...emptyStats, timeLeft: mode === "timed" ? TIMED_ROUND_SECONDS : emptyStats.timeLeft });
    setCurrentQuestion(null);
    setQuizAnswer(null);
    setMapGuesses([]);
  }, []);

  const quizStatusText = useMemo(() => {
    if (sessionStats.isComplete) {
      return `Tur bitti: ${sessionStats.correct} doğru, ${sessionStats.wrong} yanlış.`;
    }

    if (!canStartQuiz) {
      return "Seçili soru havuzunda nokta yok.";
    }

    if (!currentQuestion) {
      return quizMode === "review" && reviewFeatureIds.length === 0
        ? "Tekrar listesi boş; yeni yanlış yaptıkça burası dolacak."
        : "Seçili havuzdan yeni soru başlat.";
    }

    if (quizAnswer) {
      return quizAnswer.message;
    }

    return currentQuestion.helper;
  }, [canStartQuiz, currentQuestion, quizAnswer, quizMode, reviewFeatureIds.length, sessionStats]);

  const primaryQuizActionLabel = sessionStats.isComplete
    ? "Yeni tur"
    : currentQuestion && quizAnswer?.isFinal
      ? quizRoundMode === "timed"
        ? "Sonraki soru"
        : "Yeni soru"
      : currentQuestion
        ? "Soruyu yenile"
        : "Soruyu başlat";

  const selectedChoiceId = quizAnswer?.selectedChoiceId ?? null;
  const quizResultStatus = quizAnswer?.isFinal ? (quizAnswer.isCorrect ? "correct" : "wrong") : null;
  const shouldShowQuizTarget = Boolean(
    currentQuestion && (currentQuestion.showTargetOnMap || quizAnswer?.isFinal),
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <span className="phase-label">Phase 2 · KPSS Katmanları</span>
          <h1>KPSS Coğrafya Atlas</h1>
        </div>
        <div className="header-metrics" aria-label="Harita veri durumu">
          <span>ADM0</span>
          <strong>{country.data ? "Hazır" : "Yükleniyor"}</strong>
          <span>ADM1</span>
          <strong>{provinceCount || "..."}</strong>
          <span>Fiziki</span>
          <strong>{physicalFeatures.length || "..."}</strong>
          <span>Ekonomik</span>
          <strong>{economicFeatures.length || "..."}</strong>
        </div>
      </header>

      <main className="atlas-layout">
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
            isQuizActive={isQuizActive}
            quizGuessPoints={mapGuesses}
            quizResultStatus={quizResultStatus}
            quizTargetName={currentQuestion?.expectedLabel ?? "Soru"}
            quizTargetPoint={currentQuestion?.targetPoint ?? null}
            quizShowTargetPoint={shouldShowQuizTarget}
            quizPromptTarget={Boolean(currentQuestion?.showTargetOnMap && !quizAnswer?.isFinal)}
            onProvinceSelect={handleProvinceSelect}
            onPhysicalFeatureSelect={handlePhysicalFeatureSelect}
            onEconomicFeatureSelect={handleEconomicFeatureSelect}
            onQuizGuess={handleQuizGuess}
          />

          {(isLoading || error) && (
            <div className="map-state" role="status">
              <strong>{error ? "Harita verisi yüklenemedi" : "Harita hazırlanıyor"}</strong>
              <span>{error ?? "Türkiye, il sınırları, fiziki ve ekonomik GeoJSON katmanları yükleniyor."}</span>
            </div>
          )}
        </section>

        <aside className="side-panel" aria-label="Harita katmanları">
          <div className="panel-section quiz-panel">
            <div className="quiz-section-heading">
              <h2>Soru</h2>
              <span>{regionalQuestionPool.length} soru</span>
            </div>

            <div className="quiz-control-grid" aria-label="Soru seçenekleri">
              <label>
                <span>Soru Tipi</span>
                <select value={quizMode} onChange={(event) => handleModeChange(event.target.value as QuizMode)}>
                  {quizModeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Zorluk</span>
                <select
                  value={quizDifficulty}
                  onChange={(event) => setQuizDifficulty(event.target.value as QuizDifficulty)}
                >
                  {quizDifficultyOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tur</span>
                <select
                  value={quizRoundMode}
                  onChange={(event) => handleRoundModeChange(event.target.value as QuizRoundMode)}
                >
                  {quizRoundModeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Bölge</span>
                <select value={quizRegion} onChange={(event) => setQuizRegion(event.target.value)}>
                  <option value="all">Tüm bölgeler</option>
                  {regionOptions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="quiz-stats" aria-label="Soru performansı">
              <span>
                Doğru <strong>{sessionStats.correct}</strong>
              </span>
              <span>
                Yanlış <strong>{sessionStats.wrong}</strong>
              </span>
              <span>
                Çözülen <strong>{sessionStats.answered}</strong>
              </span>
              {quizRoundMode === "timed" ? (
                <span>
                  Süre <strong>{sessionStats.timeLeft}s</strong>
                </span>
              ) : null}
              <span>
                Tekrar <strong>{reviewFeatureIds.length}</strong>
              </span>
            </div>

            <button
              className={`quiz-launch-button${isQuizActive ? " quiz-launch-button--active" : ""}`}
              disabled={!canStartQuiz}
              onClick={handlePrimaryQuizAction}
              type="button"
            >
              {primaryQuizActionLabel}
            </button>

            <div
              className={`quiz-card${quizAnswer?.isFinal ? (quizAnswer.isCorrect ? " quiz-card--correct" : " quiz-card--wrong") : ""}`}
            >
              <span className="quiz-card__eyebrow">
                {currentQuestion
                  ? `${questionKindLabels[currentQuestion.kind]} · ${difficultyLabels[quizDifficulty]}`
                  : `${QUIZ_CORRECT_RADIUS_KM} km eşik`}
              </span>
              <strong>{currentQuestion ? currentQuestion.prompt : "Soru havuzu hazır"}</strong>
              <p>{quizStatusText}</p>

              {currentQuestion?.requiresMapAnswer ? (
                <div className="quiz-map-hint">
                  <span>{currentQuestion.allowsSecondAttempt ? "2 hak" : "1 hak"}</span>
                  <strong>{mapGuesses.length} tahmin</strong>
                </div>
              ) : null}

              {currentQuestion && currentQuestion.choices.length > 0 ? (
                <div className="quiz-choice-list" aria-label="Soru cevapları">
                  {currentQuestion.choices.map((choice) => {
                    const isCorrectChoice = currentQuestion.correctChoiceIds.includes(choice.id);
                    const isSelected = selectedChoiceId === choice.id;
                    const shouldRevealChoice = Boolean(quizAnswer?.isFinal);
                    const className = [
                      "quiz-choice",
                      isSelected ? "quiz-choice--selected" : "",
                      shouldRevealChoice && isCorrectChoice ? "quiz-choice--correct" : "",
                      shouldRevealChoice && isSelected && !isCorrectChoice ? "quiz-choice--wrong" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <button
                        className={className}
                        disabled={Boolean(quizAnswer?.isFinal)}
                        key={choice.id}
                        onClick={() => handleChoiceAnswer(choice.id)}
                        type="button"
                      >
                        <span>{choice.label}</span>
                        {choice.detail ? <small>{choice.detail}</small> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {quizAnswer ? (
                <div className="quiz-result">
                  <strong>{quizAnswer.isFinal ? (quizAnswer.isCorrect ? "Doğru" : "Yanlış") : quizAnswer.heatLabel}</strong>
                  <span>{quizAnswer.detail}</span>
                </div>
              ) : null}

              {quizAnswer?.isFinal && currentQuestion ? (
                <p className="quiz-note">{currentQuestion.kpssNote}</p>
              ) : null}

              {currentQuestion ? (
                <div className="quiz-actions">
                  <button className="quiz-actions__secondary" onClick={handleQuizClose} type="button">
                    Soru modunu kapat
                  </button>
                </div>
              ) : null}
            </div>

            <div className="quiz-filter-panel">
              <div className="quiz-filter-heading">
                <strong>Fiziki soru kategorileri</strong>
                <span>{activePhysicalQuizCategoryCount} aktif</span>
              </div>
              <div className="topic-filter-list" aria-label="Fiziki soru kategorileri">
                {physicalFeatureTopics.map((topic) => {
                  const isActive = activeTopics.includes(topic.id);
                  const isExpanded = expandedQuizTopics.includes(topic.id);
                  const topicCount = physicalFeatures.filter((feature) => feature.properties.topic === topic.id).length;
                  const topicCategories = physicalFeatureCategories.filter((category) => category.topic === topic.id);

                  return (
                    <div className="topic-filter-group" key={`quiz-${topic.id}`}>
                      <div className="topic-filter-header">
                        <label className="category-toggle topic-toggle quiz-toggle">
                          <input checked={isActive} onChange={() => handleQuizTopicToggle(topic.id)} type="checkbox" />
                          <span className="category-toggle__swatch" style={{ backgroundColor: topic.color }} />
                          <span>
                            {topic.label}
                            <small>{topicCount} soru</small>
                          </span>
                          <strong>{isActive ? "Açık" : "Kapalı"}</strong>
                        </label>
                        <button
                          aria-expanded={isExpanded}
                          aria-label={`${topic.label} soru kategorilerini ${isExpanded ? "kapat" : "aç"}`}
                          className="topic-expand-button"
                          onClick={() => handleQuizTopicExpansionToggle(topic.id)}
                          type="button"
                        >
                          {isExpanded ? "−" : "+"}
                        </button>
                      </div>

                      {isExpanded ? (
                        <div className="topic-category-list" aria-label={`${topic.label} soru kategorileri`}>
                          {topicCategories.map((category) => {
                            const isCategoryActive = activeCategories.includes(category.id);
                            const categoryCount = physicalFeatures.filter(
                              (feature) => feature.properties.category === category.id,
                            ).length;

                            return (
                              <label className="category-toggle category-toggle--nested quiz-toggle" key={`quiz-${category.id}`}>
                                <input
                                  checked={isCategoryActive}
                                  onChange={() => handleQuizCategoryToggle(category.id)}
                                  type="checkbox"
                                />
                                <span className="category-toggle__swatch" style={{ backgroundColor: category.color }} />
                                <span>
                                  {category.label}
                                  <small>{topic.label}</small>
                                </span>
                                <strong>{categoryCount}</strong>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="quiz-filter-heading">
                <strong>Ekonomik soru kategorileri</strong>
                <span>{activeEconomicQuizCategoryCount} aktif</span>
              </div>
              <div className="topic-filter-list" aria-label="Ekonomik soru kategorileri">
                {economicFeatureTopics.map((topic) => {
                  const isActive = activeEconomicTopics.includes(topic.id);
                  const isExpanded = expandedQuizEconomicTopics.includes(topic.id);
                  const topicCount = economicFeatures.filter((feature) => feature.properties.topic === topic.id).length;
                  const topicCategories = economicFeatureCategories.filter((category) => category.topic === topic.id);

                  return (
                    <div className="topic-filter-group" key={`quiz-${topic.id}`}>
                      <div className="topic-filter-header">
                        <label className="category-toggle topic-toggle quiz-toggle">
                          <input
                            checked={isActive}
                            onChange={() => handleQuizEconomicTopicToggle(topic.id)}
                            type="checkbox"
                          />
                          <span className="category-toggle__swatch" style={{ backgroundColor: topic.color }} />
                          <span>
                            {topic.label}
                            <small>{topicCount} soru</small>
                          </span>
                          <strong>{isActive ? "Açık" : "Kapalı"}</strong>
                        </label>
                        <button
                          aria-expanded={isExpanded}
                          aria-label={`${topic.label} soru kategorilerini ${isExpanded ? "kapat" : "aç"}`}
                          className="topic-expand-button"
                          onClick={() => handleQuizEconomicTopicExpansionToggle(topic.id)}
                          type="button"
                        >
                          {isExpanded ? "−" : "+"}
                        </button>
                      </div>

                      {isExpanded ? (
                        <div className="topic-category-list" aria-label={`${topic.label} soru kategorileri`}>
                          {topicCategories.map((category) => {
                            const isCategoryActive = activeEconomicCategories.includes(category.id);
                            const categoryCount = economicFeatures.filter(
                              (feature) => feature.properties.category === category.id,
                            ).length;

                            return (
                              <label className="category-toggle category-toggle--nested quiz-toggle" key={`quiz-${category.id}`}>
                                <input
                                  checked={isCategoryActive}
                                  onChange={() => handleQuizEconomicCategoryToggle(category.id)}
                                  type="checkbox"
                                />
                                <span className="category-toggle__swatch" style={{ backgroundColor: category.color }} />
                                <span>
                                  {category.label}
                                  <small>{topic.label}</small>
                                </span>
                                <strong>{categoryCount}</strong>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="panel-section">
            <h2>Katmanlar</h2>
            <LayerStatus
              label={geoJsonSources.country.label}
              detail={geoJsonSources.country.sourceName}
              isReady={Boolean(country.data)}
            />
            <LayerStatus
              label={geoJsonSources.provinces.label}
              detail={`${provinceCount || 81} il`}
              isReady={Boolean(provinces.data)}
            />
            <LayerStatus
              label={geoJsonSources.physicalFeatures.label}
              detail={
                isQuizActive
                  ? "Soru modunda gizli"
                  : `${visiblePhysicalFeatures.length || 0} / ${physicalFeatures.length || 196} görünür`
              }
              isReady={Boolean(physicalFeaturesData.data)}
            />
            <LayerStatus
              label={geoJsonSources.economicFeatures.label}
              detail={
                isQuizActive
                  ? "Soru modunda gizli"
                  : `${visibleEconomicFeatures.length || 0} / ${economicFeatures.length || 172} görünür`
              }
              isReady={Boolean(economicFeaturesData.data)}
            />
          </div>

          <div className="panel-section">
            <h2>Fiziki konular</h2>
            <div className="topic-filter-list" aria-label="Fiziki konular">
              {physicalFeatureTopics.map((topic) => {
                const isActive = activeTopics.includes(topic.id);
                const isExpanded = expandedTopics.includes(topic.id);
                const topicCount = physicalFeatures.filter((feature) => feature.properties.topic === topic.id).length;
                const topicCategories = physicalFeatureCategories.filter((category) => category.topic === topic.id);

                return (
                  <div className="topic-filter-group" key={topic.id}>
                    <div className="topic-filter-header">
                      <label className="category-toggle topic-toggle">
                        <input checked={isActive} onChange={() => handleTopicToggle(topic.id)} type="checkbox" />
                        <span className="category-toggle__swatch" style={{ backgroundColor: topic.color }} />
                        <span>
                          {topic.label}
                          <small>{topicCount} nokta</small>
                        </span>
                        <strong>{isActive ? "Açık" : "Kapalı"}</strong>
                      </label>
                      <button
                        aria-expanded={isExpanded}
                        aria-label={`${topic.label} kategorilerini ${isExpanded ? "kapat" : "aç"}`}
                        className="topic-expand-button"
                        onClick={() => handleTopicExpansionToggle(topic.id)}
                        type="button"
                      >
                        {isExpanded ? "−" : "+"}
                      </button>
                    </div>

                    {isExpanded ? (
                      <div className="topic-category-list" aria-label={`${topic.label} kategorileri`}>
                        {topicCategories.map((category) => {
                          const isCategoryActive = activeCategories.includes(category.id);
                          const categoryColor =
                            shouldUsePhysicalCategoryColors && activeTopics[0] === category.topic
                              ? getPhysicalFeatureCategory(category.id).color
                              : topic.color;
                          const categoryCount = physicalFeatures.filter(
                            (feature) => feature.properties.category === category.id,
                          ).length;

                          return (
                            <label className="category-toggle category-toggle--nested" key={category.id}>
                              <input
                                checked={isCategoryActive}
                                onChange={() => handleCategoryToggle(category.id)}
                                type="checkbox"
                              />
                              <span className="category-toggle__swatch" style={{ backgroundColor: categoryColor }} />
                              <span>
                                {category.label}
                                <small>{topic.label}</small>
                              </span>
                              <strong>{categoryCount}</strong>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel-section">
            <h2>Ekonomik konular</h2>
            <div className="topic-filter-list" aria-label="Ekonomik konular">
              {economicFeatureTopics.map((topic) => {
                const isActive = activeEconomicTopics.includes(topic.id);
                const isExpanded = expandedEconomicTopics.includes(topic.id);
                const topicCount = economicFeatures.filter((feature) => feature.properties.topic === topic.id).length;
                const topicCategories = economicFeatureCategories.filter((category) => category.topic === topic.id);

                return (
                  <div className="topic-filter-group" key={topic.id}>
                    <div className="topic-filter-header">
                      <label className="category-toggle topic-toggle">
                        <input
                          checked={isActive}
                          onChange={() => handleEconomicTopicToggle(topic.id)}
                          type="checkbox"
                        />
                        <span className="category-toggle__swatch" style={{ backgroundColor: topic.color }} />
                        <span>
                          {topic.label}
                          <small>{topicCount} nokta</small>
                        </span>
                        <strong>{isActive ? "Açık" : "Kapalı"}</strong>
                      </label>
                      <button
                        aria-expanded={isExpanded}
                        aria-label={`${topic.label} kategorilerini ${isExpanded ? "kapat" : "aç"}`}
                        className="topic-expand-button"
                        onClick={() => handleEconomicTopicExpansionToggle(topic.id)}
                        type="button"
                      >
                        {isExpanded ? "−" : "+"}
                      </button>
                    </div>

                    {isExpanded ? (
                      <div className="topic-category-list" aria-label={`${topic.label} kategorileri`}>
                        {topicCategories.map((category) => {
                          const isCategoryActive = activeEconomicCategories.includes(category.id);
                          const categoryColor =
                            shouldUseEconomicCategoryColors && activeEconomicTopics[0] === category.topic
                              ? getEconomicFeatureCategory(category.id).color
                              : topic.color;
                          const categoryCount = economicFeatures.filter(
                            (feature) => feature.properties.category === category.id,
                          ).length;

                          return (
                            <label className="category-toggle category-toggle--nested" key={category.id}>
                              <input
                                checked={isCategoryActive}
                                onChange={() => handleEconomicCategoryToggle(category.id)}
                                type="checkbox"
                              />
                              <span className="category-toggle__swatch" style={{ backgroundColor: categoryColor }} />
                              <span>
                                {category.label}
                                <small>{topic.label}</small>
                              </span>
                              <strong>{categoryCount}</strong>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel-section">
            <h2>Seçili il</h2>
            <p className="selected-province">{selectedText}</p>
          </div>

          <div className="panel-section">
            <h2>Seçili yer şekli</h2>
            {selectedFeature ? (
              <div className="selected-feature">
                <strong>{selectedFeature.name}</strong>
                <span>{selectedFeature.topicLabel}</span>
                <span>{selectedFeature.categoryLabel}</span>
                <span>{selectedFeature.region}</span>
                <p>{selectedFeature.kpssNote}</p>
                <a href={selectedFeature.sourceUrl} rel="noreferrer" target="_blank">
                  {selectedFeature.sourceName}
                </a>
              </div>
            ) : (
              <p className="selected-province">Henüz seçilmedi</p>
            )}
          </div>

          <div className="panel-section">
            <h2>Seçili ekonomik unsur</h2>
            {selectedEconomicFeature ? (
              <div className="selected-feature">
                <strong>{getEconomicFeatureDisplayName(selectedEconomicFeature)}</strong>
                <span>{selectedEconomicFeature.topicLabel}</span>
                <span>{selectedEconomicFeature.categoryLabel}</span>
                {getEconomicLocationShortLabel(selectedEconomicFeature.location) ? (
                  <span>{getEconomicLocationShortLabel(selectedEconomicFeature.location)}</span>
                ) : null}
                <p>{selectedEconomicFeature.kpssNote}</p>
                <a href={selectedEconomicFeature.sourceUrl} rel="noreferrer" target="_blank">
                  {selectedEconomicFeature.sourceName}
                </a>
              </div>
            ) : (
              <p className="selected-province">Henüz seçilmedi</p>
            )}
          </div>

          <p className="attribution">{geoJsonAttribution}</p>
        </aside>
      </main>
    </div>
  );
}

export default App;
