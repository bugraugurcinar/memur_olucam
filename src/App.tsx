import { useCallback, useEffect, useMemo, useState } from "react";
import { LayerStatus } from "./components/LayerStatus";
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

function App() {
  const [selectedProvinceName, setSelectedProvinceName] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<PhysicalFeatureProperties | null>(null);
  const [activeTopics, setActiveTopics] = useState<PhysicalFeatureTopic[]>(() =>
    physicalFeatureTopics.map((topic) => topic.id),
  );
  const [activeCategories, setActiveCategories] = useState<PhysicalFeatureCategory[]>(() =>
    physicalFeatureCategories.map((category) => category.id),
  );
  const [expandedTopics, setExpandedTopics] = useState<PhysicalFeatureTopic[]>(["mountain"]);
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
  const isLoading = country.isLoading || provinces.isLoading || physicalFeaturesData.isLoading;
  const error = country.error ?? provinces.error ?? physicalFeaturesData.error;
  const shouldUseCategoryColors = activeTopics.length === 1;

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
            onProvinceSelect={handleProvinceSelect}
            onPhysicalFeatureSelect={handlePhysicalFeatureSelect}
          />

          {(isLoading || error) && (
            <div className="map-state" role="status">
              <strong>{error ? "Harita verisi yüklenemedi" : "Harita hazırlanıyor"}</strong>
              <span>{error ?? "Türkiye, il sınırları ve fiziki GeoJSON katmanları yükleniyor."}</span>
            </div>
          )}
        </section>

        <aside className="side-panel" aria-label="Harita katmanları">
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
              detail={`${visiblePhysicalFeatures.length || 0} / ${physicalFeatures.length || 196} görünür`}
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
