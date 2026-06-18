import { useCallback, useEffect, useMemo, useState } from "react";
import { LayerStatus } from "./components/LayerStatus";
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

const QUIZ_CORRECT_RADIUS_KM = 75;

function getFeaturePoint(feature: PhysicalFeature): QuizPoint | null {
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

function getNextQuizFeatureId(features: PhysicalFeature[], previousFeatureId: string | null) {
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
  const [expandedTopics, setExpandedTopics] = useState<PhysicalFeatureTopic[]>(["mountain"]);
  const [expandedQuizTopics, setExpandedQuizTopics] = useState<PhysicalFeatureTopic[]>(["mountain"]);
  const country = useGeoJson(geoJsonSources.country.url);
  const provinces = useGeoJson(geoJsonSources.provinces.url);
  const physicalFeaturesData = useGeoJson(geoJsonSources.physicalFeatures.url);

  const provinceCount = provinces.data?.features.length ?? 0;
  const physicalFeatures = useMemo(
    () => getPhysicalFeatures(physicalFeaturesData.data),
    [physicalFeaturesData.data],
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
  const quizQuestionPool = useMemo(
    () =>
      physicalFeatures.filter(
        (feature) =>
          activeTopics.includes(feature.properties.topic) &&
          activeCategories.includes(feature.properties.category),
      ),
    [activeCategories, activeTopics, physicalFeatures],
  );
  const quizTargetFeature = useMemo(
    () => quizQuestionPool.find((feature) => feature.properties.id === quizFeatureId) ?? null,
    [quizFeatureId, quizQuestionPool],
  );
  const quizTargetPoint = useMemo(
    () => (quizTargetFeature ? getFeaturePoint(quizTargetFeature) : null),
    [quizTargetFeature],
  );
  const isLoading = country.isLoading || provinces.isLoading || physicalFeaturesData.isLoading;
  const error = country.error ?? provinces.error ?? physicalFeaturesData.error;
  const shouldUseCategoryColors = activeTopics.length === 1;
  const canStartQuiz = quizQuestionPool.length > 0 && !physicalFeaturesData.isLoading;
  const activeQuizCategoryCount = physicalFeatureCategories.filter(
    (category) => activeTopics.includes(category.topic) && activeCategories.includes(category.id),
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
  }, []);

  const handlePhysicalFeatureSelect = useCallback((feature: PhysicalFeatureProperties) => {
    setSelectedFeature(feature);
    setSelectedProvinceName(null);
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
          <span className="phase-label">Phase 2 · Fiziki Katmanlar</span>
          <h1>KPSS Coğrafya Atlas</h1>
        </div>
        <div className="header-metrics" aria-label="Harita veri durumu">
          <span>ADM0</span>
          <strong>{country.data ? "Hazır" : "Yükleniyor"}</strong>
          <span>ADM1</span>
          <strong>{provinceCount || "..."}</strong>
          <span>Fiziki</span>
          <strong>{physicalFeatures.length || "..."}</strong>
        </div>
      </header>

      <main className="atlas-layout">
        <section className="map-stage">
          <TurkeyMap
            countryData={country.data}
            provincesData={provinces.data}
            physicalFeaturesData={physicalFeaturesData.data}
            activePhysicalTopics={activeTopics}
            activePhysicalCategories={activeCategories}
            shouldUseCategoryColors={shouldUseCategoryColors}
            selectedProvinceName={selectedProvinceName}
            selectedPhysicalFeatureId={selectedFeature?.id ?? null}
            isQuizActive={isQuizActive && Boolean(quizTargetPoint)}
            quizGuessPoint={quizGuess}
            quizResultStatus={quizResult ? (quizResult.isCorrect ? "correct" : "wrong") : null}
            quizTargetName={quizTargetFeature?.properties.name ?? "Soru"}
            quizTargetPoint={quizTargetPoint}
            onProvinceSelect={handleProvinceSelect}
            onPhysicalFeatureSelect={handlePhysicalFeatureSelect}
            onQuizGuess={handleQuizGuess}
          />

          {(isLoading || error) && (
            <div className="map-state" role="status">
              <strong>{error ? "Harita verisi yüklenemedi" : "Harita hazırlanıyor"}</strong>
              <span>{error ?? "Türkiye, il sınırları ve fiziki GeoJSON katmanları yükleniyor."}</span>
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
                <strong>Soru kategorileri</strong>
                <span>{activeQuizCategoryCount} aktif</span>
              </div>
              <div className="topic-filter-list" aria-label="Soru kategorileri">
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
                            shouldUseCategoryColors && activeTopics[0] === category.topic
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

          <p className="attribution">{geoJsonAttribution}</p>
        </aside>
      </main>
    </div>
  );
}

export default App;
