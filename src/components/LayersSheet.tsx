import { useEffect, useState } from "react";
import { BottomSheet, type SheetSnap } from "./BottomSheet";
import {
  physicalFeatureCategories,
  physicalFeatureTopics,
  type PhysicalFeature,
  type PhysicalFeatureCategory,
  type PhysicalFeatureTopic,
} from "../geojson/physicalFeatures";
import {
  economicFeatureCategories,
  economicFeatureTopics,
  type EconomicFeature,
  type EconomicFeatureCategory,
  type EconomicFeatureTopic,
} from "../geojson/economicFeatures";
import { geoJsonAttribution } from "../geojson/sources";

export type LayersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  physicalFeatures: PhysicalFeature[];
  economicFeatures: EconomicFeature[];
  activeTopics: PhysicalFeatureTopic[];
  activeCategories: PhysicalFeatureCategory[];
  activeEconomicTopics: EconomicFeatureTopic[];
  activeEconomicCategories: EconomicFeatureCategory[];
  onTopicToggle: (topic: PhysicalFeatureTopic) => void;
  onCategoryToggle: (category: PhysicalFeatureCategory) => void;
  onSelectAllTopics: () => void;
  onClearAllTopics: () => void;
  onEconomicTopicToggle: (topic: EconomicFeatureTopic) => void;
  onEconomicCategoryToggle: (category: EconomicFeatureCategory) => void;
  onSelectAllEconomicTopics: () => void;
  onClearAllEconomicTopics: () => void;
};

/** Harita sekmesindeki katman filtreleri: FAB + backdrop'lu alt sayfa. */
export function LayersSheet({
  open,
  onOpenChange,
  physicalFeatures,
  economicFeatures,
  activeTopics,
  activeCategories,
  activeEconomicTopics,
  activeEconomicCategories,
  onTopicToggle,
  onCategoryToggle,
  onSelectAllTopics,
  onClearAllTopics,
  onEconomicTopicToggle,
  onEconomicCategoryToggle,
  onSelectAllEconomicTopics,
  onClearAllEconomicTopics,
}: LayersSheetProps) {
  const [snap, setSnap] = useState<SheetSnap>("full");

  useEffect(() => {
    if (open) {
      setSnap("full");
    }
  }, [open]);

  // Aşağı sürükleyip peek'e düşürmek sayfayı kapatır (modal davranış).
  const handleSnapChange = (next: SheetSnap) => {
    if (next === "peek") {
      onOpenChange(false);
      return;
    }
    setSnap(next);
  };

  return (
    <>
      <button
        className="layers-fab glass"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        type="button"
      >
        🗺️ Katmanlar
      </button>

      {open ? (
        <>
          <div className="sheet-backdrop" onClick={() => onOpenChange(false)} aria-hidden="true" />
          <BottomSheet snap={snap} onSnapChange={handleSnapChange} className="layers-sheet" ariaLabel="Harita katmanları">
            <div className="panel-section">
              <h2>Fiziki konular</h2>
              <div className="topic-filter-toolbar">
                <button onClick={onSelectAllTopics} type="button">
                  Tümünü göster
                </button>
                <button onClick={onClearAllTopics} type="button">
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
                        onClick={() => onTopicToggle(topic.id)}
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
                              onClick={() => onCategoryToggle(category.id)}
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
                <button onClick={onSelectAllEconomicTopics} type="button">
                  Tümünü göster
                </button>
                <button onClick={onClearAllEconomicTopics} type="button">
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
                        onClick={() => onEconomicTopicToggle(topic.id)}
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
                              onClick={() => onEconomicCategoryToggle(category.id)}
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
          </BottomSheet>
        </>
      ) : null}
    </>
  );
}
