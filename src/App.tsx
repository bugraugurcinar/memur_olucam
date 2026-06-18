import { useCallback, useEffect, useMemo, useState } from "react";
import { LayerStatus } from "./components/LayerStatus";
import {
  economicFeatureCategories,
  economicFeatureTopics,
  getEconomicFeatureCategory,
  getEconomicFeatures,
  type EconomicFeature,
  type EconomicFeatureCategory,
  type EconomicFeatureProperties,
  type EconomicFeatureTopic,
} from "./geojson/economicFeatures";
import {
  getPhysicalFeatureCategory,
  getPhysicalFeatures,
  physicalFeatureCategories,
  physicalFeatureTopics,
  type PhysicalFeature,
  type PhysicalFeatureCategory,
  type PhysicalFeatureProperties,
  type PhysicalFeatureTopic,
} from "./geojson/physicalFeatures";
import { geoJsonAttribution, geoJsonSources } from "./geojson/sources";
import { useGeoJson } from "./hooks/useGeoJson";
import { TurkeyMap } from "./maps/TurkeyMap";

type QuizPoint = {
  lat: number;
  lng: number;
};

type QuizResult = {
  distanceKm: number;
  isCorrect: boolean;
};

type QuizFeature = PhysicalFeature | EconomicFeature;

const QUIZ_CORRECT_RADIUS_KM = 75;

function getFeaturePoint(feature: QuizFeature): QuizPoint | null {
  const [lng, lat] = feature.geometry.coordinates;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  return { lat, lng };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(from: QuizPoint, to: QuizPoint) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const startLat = toRadians(from.lat);
  const endLat = toRadians(to.lat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function formatDistanceKm(distanceKm: number) {
  return distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm).toString();
}

function getNextQuizFeatureId(features: QuizFeature[], previousFeatureId: string | null) {
  if (features.length === 0) {
    return null;
  }

  const candidates =
    features.length > 1
      ? features.filter((feature) => feature.properties.id !== previousFeatureId)
      : features;
  const randomIndex = Math.floor(Math.random() * candidates.length);

  return candidates[randomIndex].properties.id;
}

function App() {
  const [selectedProvinceName, setSelectedProvinceName] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<PhysicalFeatureProperties | null>(null);
  const [selectedEconomicFeature, setSelectedEconomicFeature] =
    useState<EconomicFeatureProperties | null>(null);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [quizFeatureId, setQuizFeatureId] = useState<string | null>(null);
  const [quizGuess, setQuizGuess] = useState<QuizPoint | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
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
  const quizTargetFeature = useMemo(
    () => quizQuestionPool.find((feature) => feature.properties.id === quizFeatureId) ?? null,
    [quizFeatureId, quizQuestionPool],
  );
  const quizTargetPoint = useMemo(
    () => (quizTargetFeature ? getFeaturePoint(quizTargetFeature) : null),
    [quizTargetFeature],
  );
  const isLoading =
    country.isLoading || provinces.isLoading || physicalFeaturesData.isLoading || economicFeaturesData.isLoading;
  const error = country.error ?? provinces.error ?? physicalFeaturesData.error ?? economicFeaturesData.error;
  const shouldUsePhysicalCategoryColors = activeTopics.length === 1;
  const shouldUseEconomicCategoryColors = activeEconomicTopics.length === 1;
  const canStartQuiz =
    quizQuestionPool.length > 0 && !physicalFeaturesData.isLoading && !economicFeaturesData.isLoading;
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
    if (quizFeatureId && !quizQuestionPool.some((feature) => feature.properties.id === quizFeatureId)) {
      setIsQuizActive(false);
      setQuizFeatureId(null);
      setQuizGuess(null);
      setQuizResult(null);
    }
  }, [quizFeatureId, quizQuestionPool]);

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

  const handleQuizStart = useCallback(() => {
    const nextFeatureId = getNextQuizFeatureId(quizQuestionPool, quizFeatureId);

    if (!nextFeatureId) {
      return;
    }

    setIsQuizActive(true);
    setQuizFeatureId(nextFeatureId);
    setQuizGuess(null);
    setQuizResult(null);
    setSelectedProvinceName(null);
    setSelectedFeature(null);
    setSelectedEconomicFeature(null);
  }, [quizFeatureId, quizQuestionPool]);

  const handleQuizClose = useCallback(() => {
    setIsQuizActive(false);
    setQuizFeatureId(null);
    setQuizGuess(null);
    setQuizResult(null);
  }, []);

  const handleQuizGuess = useCallback(
    (guess: QuizPoint) => {
      if (!quizTargetPoint) {
        return;
      }

      const distanceKm = getDistanceKm(guess, quizTargetPoint);

      setIsQuizActive(true);
      setQuizGuess(guess);
      setQuizResult({
        distanceKm,
        isCorrect: distanceKm <= QUIZ_CORRECT_RADIUS_KM,
      });
      setSelectedProvinceName(null);
      setSelectedFeature(null);
      setSelectedEconomicFeature(null);
    },
    [quizTargetPoint],
  );

  const quizStatusText = useMemo(() => {
    if (!canStartQuiz) {
      return "Seçili soru havuzunda nokta yok.";
    }

    if (!isQuizActive) {
      return "Seçili havuzdan rastgele soru başlat.";
    }

    if (!quizTargetPoint) {
      return "Soru verisi hazırlanıyor.";
    }

    if (!quizResult) {
      return "Haritada tahmin noktanı seç.";
    }

    return quizResult.isCorrect
      ? "Doğru. Tahminin kabul aralığında."
      : "Yanlış. Doğru nokta haritada gösterildi.";
  }, [canStartQuiz, isQuizActive, quizResult, quizTargetPoint]);

  const primaryQuizActionLabel = quizResult
    ? "Yeni soru"
    : isQuizActive
      ? "Soruyu yenile"
      : "Soruyu başlat";

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
            isQuizActive={isQuizActive && Boolean(quizTargetPoint)}
            quizGuessPoint={quizGuess}
            quizResultStatus={quizResult ? (quizResult.isCorrect ? "correct" : "wrong") : null}
            quizTargetName={quizTargetFeature?.properties.name ?? "Soru"}
            quizTargetPoint={quizTargetPoint}
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
              <span>{quizQuestionPool.length} soru</span>
            </div>
            <button
              className={`quiz-launch-button${isQuizActive ? " quiz-launch-button--active" : ""}`}
              disabled={!canStartQuiz}
              onClick={handleQuizStart}
              type="button"
            >
              {primaryQuizActionLabel}
            </button>
            <div
              className={`quiz-card${quizResult ? (quizResult.isCorrect ? " quiz-card--correct" : " quiz-card--wrong") : ""}`}
            >
              <span className="quiz-card__eyebrow">{QUIZ_CORRECT_RADIUS_KM} km eşik</span>
              <strong>{quizTargetFeature ? `${quizTargetFeature.properties.name} nerede?` : "Soru havuzu hazır"}</strong>
              <p>{quizStatusText}</p>

              {quizResult ? (
                <div className="quiz-result">
                  <strong>{quizResult.isCorrect ? "Doğru" : "Yanlış"}</strong>
                  <span>{formatDistanceKm(quizResult.distanceKm)} km uzaklık</span>
                </div>
              ) : null}

              {isQuizActive ? (
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
                <strong>{selectedEconomicFeature.name}</strong>
                <span>{selectedEconomicFeature.topicLabel}</span>
                <span>{selectedEconomicFeature.categoryLabel}</span>
                <span>{selectedEconomicFeature.location}</span>
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
