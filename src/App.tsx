import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { QUIZ_CORRECT_RADIUS_KM, filterFeaturesByRegion, formatDistanceKm, getDistanceKm, getRegionOptions } from "./quiz/geoUtils";
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

const PLUS_RECENT_QUESTION_HISTORY_LIMIT = 8;

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
  const [plusTopic, setPlusTopic] = useState<PlusQuestionTopic>("mixed");
  const [plusMode, setPlusMode] = useState<PlusQuestionMode>("mixed");
  const [plusAssignments, setPlusAssignments] = useState<Record<string, string>>({});
  const [plusSelectedTokenId, setPlusSelectedTokenId] = useState<string | null>(null);
  const [plusSelectedTargetIds, setPlusSelectedTargetIds] = useState<string[]>([]);
  const [quizRegion, setQuizRegion] = useState("all");
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
  const [expandedTopics, setExpandedTopics] = useState<PhysicalFeatureTopic[]>(["mountain"]);
  const [expandedEconomicTopics, setExpandedEconomicTopics] = useState<EconomicFeatureTopic[]>([
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
  const plusAvailability = useMemo(
    () => getPlusAvailability(regionalQuestionPool, plusTopic, plusMode),
    [plusMode, plusTopic, regionalQuestionPool],
  );
  const isLoading =
    country.isLoading || provinces.isLoading || physicalFeaturesData.isLoading || economicFeaturesData.isLoading;
  const error = country.error ?? provinces.error ?? physicalFeaturesData.error ?? economicFeaturesData.error;
  const shouldUsePhysicalCategoryColors = activeTopics.length === 1;
  const shouldUseEconomicCategoryColors = activeEconomicTopics.length === 1;
  const canStartPlus =
    plusAvailability.total > 0 && !physicalFeaturesData.isLoading && !economicFeaturesData.isLoading;
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
    if (
      currentPlusQuestion &&
      !currentPlusQuestion.targets.every((target) =>
        regionalQuestionPool.some((feature) => feature.properties.id === target.id),
      )
    ) {
      setCurrentPlusQuestion(null);
      setPlusAnswer(null);
      setPlusAssignments({});
      setPlusSelectedTokenId(null);
      setPlusSelectedTargetIds([]);
    }
  }, [currentPlusQuestion, regionalQuestionPool]);

  useEffect(() => {
    if (quizRegion !== "all" && !regionOptions.includes(quizRegion)) {
      setQuizRegion("all");
    }
  }, [quizRegion, regionOptions]);

  const startNextPlusQuestion = useCallback(() => {
    const nextQuestion = generatePlusQuestion({
      features: regionalQuestionPool,
      topic: plusTopic,
      mode: plusMode,
      recentQuestionIds: recentPlusQuestionIdsRef.current,
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
  }, [plusMode, plusTopic, regionalQuestionPool]);

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

  const handlePlusTopicChange = useCallback((topic: PlusQuestionTopic) => {
    setPlusTopic(topic);
    setCurrentPlusQuestion(null);
    setPlusAnswer(null);
    setPlusAssignments({});
    setPlusSelectedTokenId(null);
    setPlusSelectedTargetIds([]);
  }, []);

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

      setPlusAnswer({ isCorrect, message, detail, wrongTargetIds, selectedTokenId });
      setPlusSelectedTokenId(null);
    },
    [currentPlusQuestion, plusAnswer],
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
  const plusTopicLabel =
    plusQuestionTopicOptions.find((option) => option.id === plusTopic)?.label ?? "Karma Soru+";

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
            isPlusActive={isPlusActive}
            isPlusMapLocateActive={isPlusMapLocateActive}
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
            <div className="map-state" role="status">
              <strong>{error ? "Harita verisi yüklenemedi" : "Harita hazırlanıyor"}</strong>
              <span>{error ?? "Türkiye, il sınırları, fiziki ve ekonomik GeoJSON katmanları yükleniyor."}</span>
            </div>
          )}
        </section>

        <aside className="side-panel" aria-label="Harita katmanları">
          <div className="panel-section plus-panel">
            <div className="quiz-section-heading">
              <h2>Soru+</h2>
              <span>{plusAvailability.total} soru</span>
            </div>

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
              <label>
                <span>Konu</span>
                <select
                  value={plusTopic}
                  onChange={(event) => handlePlusTopicChange(event.target.value as PlusQuestionTopic)}
                >
                  {plusQuestionTopicOptions.map((option) => (
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

            <div
              className={`quiz-card plus-card${plusAnswer ? (plusAnswer.isCorrect ? " quiz-card--correct" : " quiz-card--wrong") : ""}`}
            >
              <span className="quiz-card__eyebrow">
                {currentPlusQuestion
                  ? `${currentPlusQuestion.title} · ${plusQuestionKindLabels[currentPlusQuestion.kind]}`
                  : `${plusTopicLabel} · harita etkileşimi`}
              </span>
              <strong>{currentPlusQuestion ? currentPlusQuestion.prompt : "Harita odaklı soru havuzu hazır"}</strong>
              <p>
                {plusAnswer
                  ? plusAnswer.message
                  : currentPlusQuestion
                    ? currentPlusQuestion.helper
                    : canStartPlus
                      ? "Soru+ başlatınca mevcut katmanlar kapanır ve sadece soru hedefleri kalır."
                      : "Seçili filtrelerde Soru+ üretilecek yeterli veri yok."}
              </p>

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
                isPlusActive
                  ? "Soru modunda gizli"
                  : `${visiblePhysicalFeatures.length || 0} / ${physicalFeatures.length || 196} görünür`
              }
              isReady={Boolean(physicalFeaturesData.data)}
            />
            <LayerStatus
              label={geoJsonSources.economicFeatures.label}
              detail={
                isPlusActive
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
