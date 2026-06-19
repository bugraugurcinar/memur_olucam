import { useEffect, useRef } from "react";
import L, { type LatLngBoundsExpression, type Layer, type LeafletMouseEvent } from "leaflet";
import type { Feature, FeatureCollection, GeoJsonProperties } from "geojson";
import {
  getEconomicFeatureColor,
  getEconomicFeatureDisplayName,
  getEconomicLocationShortLabel,
  isEconomicFeature,
  type EconomicFeatureCategory,
  type EconomicFeatureProperties,
  type EconomicFeatureTopic,
} from "../geojson/economicFeatures";
import {
  getPhysicalFeatureColor,
  isPhysicalFeature,
  type PhysicalFeatureCategory,
  type PhysicalFeatureProperties,
  type PhysicalFeatureTopic,
} from "../geojson/physicalFeatures";

type QuizPoint = {
  lat: number;
  lng: number;
};

type QuizMapOption = {
  id: string;
  label: string;
  point: QuizPoint;
  name: string;
  categoryLabel: string;
  isCorrect: boolean;
};

type QuizResultStatus = "correct" | "wrong" | null;

type TurkeyMapProps = {
  countryData: FeatureCollection | null;
  provincesData: FeatureCollection | null;
  physicalFeaturesData: FeatureCollection | null;
  economicFeaturesData: FeatureCollection | null;
  activePhysicalTopics: PhysicalFeatureTopic[];
  activePhysicalCategories: PhysicalFeatureCategory[];
  activeEconomicTopics: EconomicFeatureTopic[];
  activeEconomicCategories: EconomicFeatureCategory[];
  shouldUsePhysicalCategoryColors: boolean;
  shouldUseEconomicCategoryColors: boolean;
  selectedProvinceName: string | null;
  selectedPhysicalFeatureId: string | null;
  selectedEconomicFeatureId: string | null;
  isQuizActive: boolean;
  quizGuessPoints: QuizPoint[];
  quizResultStatus: QuizResultStatus;
  quizTargetName: string;
  quizTargetPoint: QuizPoint | null;
  quizShowTargetPoint: boolean;
  quizPromptTarget: boolean;
  quizMapOptions: QuizMapOption[];
  quizSelectedOptionId: string | null;
  quizCorrectOptionIds: string[];
  onProvinceSelect: (provinceName: string) => void;
  onPhysicalFeatureSelect: (feature: PhysicalFeatureProperties) => void;
  onEconomicFeatureSelect: (feature: EconomicFeatureProperties) => void;
  onQuizGuess: (point: QuizPoint) => void;
  onQuizOptionSelect: (optionId: string) => void;
};

type ProvinceLayer = Layer & {
  feature?: Feature;
};

type PhysicalFeatureLayer = Layer & {
  feature?: Feature;
};

type EconomicFeatureLayer = Layer & {
  feature?: Feature;
};

const TURKEY_BOUNDS: LatLngBoundsExpression = [
  [35.45, 25.2],
  [42.35, 45.3],
];
const PHYSICAL_FEATURE_PANE = "physical-feature-pane";
const ECONOMIC_FEATURE_PANE = "economic-feature-pane";
const QUIZ_PANE = "quiz-pane";

function getShapeName(properties: GeoJsonProperties | null | undefined) {
  const shapeName = properties?.shapeName;
  return typeof shapeName === "string" ? shapeName : "Bilinmeyen il";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;",
    };

    return entities[character];
  });
}

function provinceStyle(provinceName: string, selectedProvinceName: string | null): L.PathOptions {
  const isSelected = provinceName === selectedProvinceName;

  return {
    color: isSelected ? "#f59e0b" : "#2563eb",
    fillColor: isSelected ? "#fbbf24" : "#38bdf8",
    fillOpacity: isSelected ? 0.56 : 0.2,
    opacity: 0.92,
    weight: isSelected ? 2.5 : 1,
  };
}

function quizProvinceStyle(): L.PathOptions {
  return {
    color: "#2563eb",
    fillColor: "#38bdf8",
    fillOpacity: 0.2,
    opacity: 0.68,
    weight: 0.8,
  };
}

function countryStyle(): L.PathOptions {
  return {
    color: "#0f172a",
    fillOpacity: 0,
    opacity: 0.9,
    weight: 2.6,
  };
}

function physicalFeatureStyle(
  feature: PhysicalFeatureProperties,
  selectedFeatureId: string | null,
  shouldUseCategoryColors: boolean,
): L.CircleMarkerOptions {
  const isSelected = feature.id === selectedFeatureId;

  return {
    pane: PHYSICAL_FEATURE_PANE,
    radius: isSelected ? 8 : 5.5,
    color: isSelected ? "#fbbf24" : "#ffffff",
    fillColor: getPhysicalFeatureColor(feature, shouldUseCategoryColors),
    fillOpacity: isSelected ? 0.96 : 0.82,
    opacity: 1,
    weight: isSelected ? 2.5 : 1.4,
  };
}

function economicFeatureStyle(
  feature: EconomicFeatureProperties,
  selectedFeatureId: string | null,
  shouldUseCategoryColors: boolean,
): L.CircleMarkerOptions {
  const isSelected = feature.id === selectedFeatureId;

  return {
    pane: ECONOMIC_FEATURE_PANE,
    radius: isSelected ? 8 : 5.5,
    color: isSelected ? "#fbbf24" : "#111827",
    fillColor: getEconomicFeatureColor(feature, shouldUseCategoryColors),
    fillOpacity: isSelected ? 0.96 : 0.82,
    opacity: 1,
    weight: isSelected ? 2.5 : 1.25,
  };
}

function createQuizIcon(
  markerType: "guess" | "answer" | "prompt" | "option",
  resultStatus: QuizResultStatus = null,
  label?: string,
) {
  const markerClass =
    markerType === "guess"
      ? "quiz-guess-marker"
      : markerType === "prompt"
        ? "quiz-prompt-marker"
        : markerType === "option"
          ? "quiz-option-marker"
          : "quiz-answer-marker";
  const statusClass = resultStatus ? ` quiz-map-marker--${resultStatus}` : "";
  const markerLabel = label ?? (markerType === "guess" ? "T" : markerType === "prompt" ? "?" : "D");

  return L.divIcon({
    className: `quiz-map-marker ${markerClass}${statusClass}`,
    html: `<span><b>${markerLabel}</b></span>`,
    iconAnchor: [15, 15],
    iconSize: [30, 30],
  });
}

export function TurkeyMap({
  countryData,
  provincesData,
  physicalFeaturesData,
  economicFeaturesData,
  activePhysicalTopics,
  activePhysicalCategories,
  activeEconomicTopics,
  activeEconomicCategories,
  shouldUsePhysicalCategoryColors,
  shouldUseEconomicCategoryColors,
  selectedProvinceName,
  selectedPhysicalFeatureId,
  selectedEconomicFeatureId,
  isQuizActive,
  quizGuessPoints,
  quizResultStatus,
  quizTargetName,
  quizTargetPoint,
  quizShowTargetPoint,
  quizPromptTarget,
  quizMapOptions,
  quizSelectedOptionId,
  quizCorrectOptionIds,
  onProvinceSelect,
  onPhysicalFeatureSelect,
  onEconomicFeatureSelect,
  onQuizGuess,
  onQuizOptionSelect,
}: TurkeyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const countryLayerRef = useRef<L.GeoJSON | null>(null);
  const provinceLayerRef = useRef<L.GeoJSON | null>(null);
  const physicalFeatureLayerRef = useRef<L.GeoJSON | null>(null);
  const economicFeatureLayerRef = useRef<L.GeoJSON | null>(null);
  const quizLayerRef = useRef<L.LayerGroup | null>(null);
  const isQuizActiveRef = useRef(isQuizActive);
  const onQuizGuessRef = useRef(onQuizGuess);
  const onQuizOptionSelectRef = useRef(onQuizOptionSelect);
  const selectedProvinceRef = useRef<string | null>(selectedProvinceName);
  const selectedFeatureRef = useRef<string | null>(selectedPhysicalFeatureId);
  const selectedEconomicFeatureRef = useRef<string | null>(selectedEconomicFeatureId);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      attributionControl: false,
      maxBounds: TURKEY_BOUNDS,
      maxBoundsViscosity: 0.65,
      minZoom: 5,
      scrollWheelZoom: true,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.createPane(PHYSICAL_FEATURE_PANE);
    map.createPane(ECONOMIC_FEATURE_PANE);
    map.createPane(QUIZ_PANE);
    const physicalFeaturePane = map.getPane(PHYSICAL_FEATURE_PANE);
    const economicFeaturePane = map.getPane(ECONOMIC_FEATURE_PANE);
    const quizPane = map.getPane(QUIZ_PANE);

    if (physicalFeaturePane) {
      physicalFeaturePane.style.zIndex = "625";
      physicalFeaturePane.style.pointerEvents = "auto";
    }

    if (economicFeaturePane) {
      economicFeaturePane.style.zIndex = "640";
      economicFeaturePane.style.pointerEvents = "auto";
    }

    if (quizPane) {
      quizPane.style.zIndex = "700";
      quizPane.style.pointerEvents = "auto";
    }

    map.fitBounds(TURKEY_BOUNDS, { padding: [18, 18] });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    isQuizActiveRef.current = isQuizActive;
    onQuizGuessRef.current = onQuizGuess;
    onQuizOptionSelectRef.current = onQuizOptionSelect;
  }, [isQuizActive, onQuizGuess, onQuizOptionSelect]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const handleMapClick = (event: LeafletMouseEvent) => {
      if (!isQuizActiveRef.current) {
        return;
      }

      onQuizGuessRef.current({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, []);

  useEffect(() => {
    selectedProvinceRef.current = selectedProvinceName;

    provinceLayerRef.current?.eachLayer((layer: ProvinceLayer) => {
      const provinceName = getShapeName(layer.feature?.properties);

      if (layer instanceof L.Path) {
        layer.setStyle(isQuizActive ? quizProvinceStyle() : provinceStyle(provinceName, selectedProvinceName));
      }
    });
  }, [isQuizActive, selectedProvinceName]);

  useEffect(() => {
    selectedFeatureRef.current = selectedPhysicalFeatureId;

    physicalFeatureLayerRef.current?.eachLayer((layer: PhysicalFeatureLayer) => {
      const feature = layer.feature;

      if (feature && isPhysicalFeature(feature) && layer instanceof L.CircleMarker) {
        layer.setStyle(physicalFeatureStyle(feature.properties, selectedPhysicalFeatureId, shouldUsePhysicalCategoryColors));
        layer.setRadius(feature.properties.id === selectedPhysicalFeatureId ? 8 : 5.5);
      }
    });
  }, [selectedPhysicalFeatureId, shouldUsePhysicalCategoryColors]);

  useEffect(() => {
    selectedEconomicFeatureRef.current = selectedEconomicFeatureId;

    economicFeatureLayerRef.current?.eachLayer((layer: EconomicFeatureLayer) => {
      const feature = layer.feature;

      if (feature && isEconomicFeature(feature) && layer instanceof L.CircleMarker) {
        layer.setStyle(
          economicFeatureStyle(feature.properties, selectedEconomicFeatureId, shouldUseEconomicCategoryColors),
        );
        layer.setRadius(feature.properties.id === selectedEconomicFeatureId ? 8 : 5.5);
      }
    });
  }, [selectedEconomicFeatureId, shouldUseEconomicCategoryColors]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !countryData) {
      return;
    }

    countryLayerRef.current?.remove();
    provinceLayerRef.current?.remove();
    provinceLayerRef.current = null;

    const countryLayer = L.geoJSON(countryData, {
      interactive: false,
      style: countryStyle,
    }).addTo(map);

    countryLayerRef.current = countryLayer;

    if (isQuizActive && provincesData) {
      const provinceLayer = L.geoJSON(provincesData, {
        interactive: false,
        style: quizProvinceStyle,
      }).addTo(map);

      provinceLayerRef.current = provinceLayer;
    } else if (provincesData) {
      const provinceLayer = L.geoJSON(provincesData, {
        onEachFeature: (feature, layer: ProvinceLayer) => {
          const provinceName = getShapeName(feature.properties);

          layer.bindTooltip(provinceName, {
            direction: "top",
            opacity: 0.94,
            sticky: true,
          });

          layer.on({
            click: () => onProvinceSelect(provinceName),
            mouseout: () => {
              if (layer instanceof L.Path) {
                layer.setStyle(provinceStyle(provinceName, selectedProvinceRef.current));
              }
            },
            mouseover: (event: LeafletMouseEvent) => {
              if (event.target instanceof L.Path) {
                event.target.setStyle({
                  color: "#f97316",
                  fillColor: "#fb923c",
                  fillOpacity: 0.46,
                  weight: 2,
                });
                event.target.bringToFront();
              }
            },
          });
        },
        style: (feature) => provinceStyle(getShapeName(feature?.properties), selectedProvinceRef.current),
      }).addTo(map);

      provinceLayerRef.current = provinceLayer;
    }

    map.fitBounds(countryLayer.getBounds(), { padding: [24, 24], maxZoom: 7 });

    return () => {
      countryLayer.remove();
      provinceLayerRef.current?.remove();
    };
  }, [countryData, provincesData, isQuizActive, onProvinceSelect]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !physicalFeaturesData) {
      return;
    }

    physicalFeatureLayerRef.current?.remove();
    physicalFeatureLayerRef.current = null;

    if (isQuizActive) {
      return;
    }

    const visibleTopics = new Set(activePhysicalTopics);
    const visibleCategories = new Set(activePhysicalCategories);
    const physicalFeatureLayer = L.geoJSON(physicalFeaturesData, {
      filter: (feature) =>
        isPhysicalFeature(feature) &&
        visibleTopics.has(feature.properties.topic) &&
        visibleCategories.has(feature.properties.category),
      onEachFeature: (feature, layer: PhysicalFeatureLayer) => {
        if (!isPhysicalFeature(feature)) {
          return;
        }

        const physicalFeature = feature.properties;

        layer.bindTooltip(`${physicalFeature.name} · ${physicalFeature.categoryLabel}`, {
          direction: "top",
          opacity: 0.96,
          sticky: true,
        });

        layer.bindPopup(
          `<strong>${escapeHtml(physicalFeature.name)}</strong><br />${escapeHtml(
            physicalFeature.topicLabel,
          )}<br />${escapeHtml(physicalFeature.categoryLabel)}<br />${escapeHtml(physicalFeature.region)}`,
        );

        layer.on({
          click: () => onPhysicalFeatureSelect(physicalFeature),
          mouseout: () => {
            if (layer instanceof L.CircleMarker) {
              layer.closeTooltip();
              layer.setStyle(
                physicalFeatureStyle(physicalFeature, selectedFeatureRef.current, shouldUsePhysicalCategoryColors),
              );
              layer.setRadius(physicalFeature.id === selectedFeatureRef.current ? 8 : 5.5);
            }
          },
          mouseover: () => {
            if (layer instanceof L.CircleMarker) {
              layer.openTooltip();
              layer.setStyle({
                color: "#fbbf24",
                fillOpacity: 1,
                weight: 2.5,
              });
              layer.setRadius(8);
              layer.bringToFront();
            }
          },
        });
      },
      pointToLayer: (feature, latlng) => {
        if (isPhysicalFeature(feature)) {
          return L.circleMarker(
            latlng,
            physicalFeatureStyle(feature.properties, selectedFeatureRef.current, shouldUsePhysicalCategoryColors),
          );
        }

        return L.circleMarker(latlng);
      },
    }).addTo(map);

    physicalFeatureLayerRef.current = physicalFeatureLayer;

    return () => {
      physicalFeatureLayer.remove();
    };
  }, [
    physicalFeaturesData,
    activePhysicalCategories,
    activePhysicalTopics,
    isQuizActive,
    onPhysicalFeatureSelect,
    shouldUsePhysicalCategoryColors,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !economicFeaturesData) {
      return;
    }

    economicFeatureLayerRef.current?.remove();
    economicFeatureLayerRef.current = null;

    if (isQuizActive) {
      return;
    }

    const visibleTopics = new Set(activeEconomicTopics);
    const visibleCategories = new Set(activeEconomicCategories);
    const economicFeatureLayer = L.geoJSON(economicFeaturesData, {
      filter: (feature) =>
        isEconomicFeature(feature) &&
        visibleTopics.has(feature.properties.topic) &&
        visibleCategories.has(feature.properties.category),
      onEachFeature: (feature, layer: EconomicFeatureLayer) => {
        if (!isEconomicFeature(feature)) {
          return;
        }

        const economicFeature = feature.properties;
        const economicFeatureDisplayName = getEconomicFeatureDisplayName(economicFeature);
        const economicFeatureLocationLabel = getEconomicLocationShortLabel(economicFeature.location);

        layer.bindTooltip(economicFeatureDisplayName, {
          direction: "top",
          opacity: 0.96,
          sticky: true,
        });

        layer.bindPopup(
          `<strong>${escapeHtml(economicFeatureDisplayName)}</strong><br />${escapeHtml(
            economicFeature.topicLabel,
          )}<br />${escapeHtml(economicFeature.categoryLabel)}${
            economicFeatureLocationLabel ? `<br />${escapeHtml(economicFeatureLocationLabel)}` : ""
          }`,
        );

        layer.on({
          click: () => onEconomicFeatureSelect(economicFeature),
          mouseout: () => {
            if (layer instanceof L.CircleMarker) {
              layer.closeTooltip();
              layer.setStyle(
                economicFeatureStyle(
                  economicFeature,
                  selectedEconomicFeatureRef.current,
                  shouldUseEconomicCategoryColors,
                ),
              );
              layer.setRadius(economicFeature.id === selectedEconomicFeatureRef.current ? 8 : 5.5);
            }
          },
          mouseover: () => {
            if (layer instanceof L.CircleMarker) {
              layer.openTooltip();
              layer.setStyle({
                color: "#fbbf24",
                fillOpacity: 1,
                weight: 2.5,
              });
              layer.setRadius(8);
              layer.bringToFront();
            }
          },
        });
      },
      pointToLayer: (feature, latlng) => {
        if (isEconomicFeature(feature)) {
          return L.circleMarker(
            latlng,
            economicFeatureStyle(
              feature.properties,
              selectedEconomicFeatureRef.current,
              shouldUseEconomicCategoryColors,
            ),
          );
        }

        return L.circleMarker(latlng);
      },
    }).addTo(map);

    economicFeatureLayerRef.current = economicFeatureLayer;

    return () => {
      economicFeatureLayer.remove();
    };
  }, [
    economicFeaturesData,
    activeEconomicCategories,
    activeEconomicTopics,
    isQuizActive,
    onEconomicFeatureSelect,
    shouldUseEconomicCategoryColors,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    quizLayerRef.current?.remove();

    const quizLayer = L.layerGroup().addTo(map);
    const mapOptionLatLngs = quizMapOptions.map((option) => L.latLng(option.point.lat, option.point.lng));
    const guessLatLngs = quizGuessPoints.map((point) => L.latLng(point.lat, point.lng));
    const lastGuessLatLng = guessLatLngs[guessLatLngs.length - 1] ?? null;
    const targetLatLng = quizTargetPoint ? L.latLng(quizTargetPoint.lat, quizTargetPoint.lng) : null;

    quizMapOptions.forEach((option) => {
      const optionLatLng = L.latLng(option.point.lat, option.point.lng);
      const isCorrectOption = quizCorrectOptionIds.includes(option.id);
      const isSelectedOption = option.id === quizSelectedOptionId;
      const optionStatus: QuizResultStatus = quizResultStatus
        ? isCorrectOption
          ? "correct"
          : isSelectedOption
            ? "wrong"
            : null
        : null;
      const marker = L.marker(optionLatLng, {
        bubblingMouseEvents: false,
        icon: createQuizIcon("option", optionStatus, option.label),
        keyboard: true,
        pane: QUIZ_PANE,
      })
        .bindTooltip(
          quizResultStatus
            ? `${option.label}: ${option.name} · ${option.categoryLabel}`
            : `${option.label} noktası`,
          {
            direction: "top",
            opacity: 0.96,
          },
        )
        .addTo(quizLayer);

      if (!quizResultStatus) {
        marker.on("click", () => onQuizOptionSelectRef.current(option.id));
      }

      if (quizResultStatus && (isCorrectOption || isSelectedOption)) {
        marker.openTooltip();
      }
    });

    guessLatLngs.forEach((guessLatLng, index) => {
      L.marker(guessLatLng, {
        icon: createQuizIcon("guess", null, guessLatLngs.length > 1 ? `T${index + 1}` : "T"),
        keyboard: false,
        pane: QUIZ_PANE,
      })
        .bindTooltip(guessLatLngs.length > 1 ? `${index + 1}. tahmin` : "Tahmin", {
          direction: "top",
          opacity: 0.96,
        })
        .addTo(quizLayer);
    });

    if (lastGuessLatLng && targetLatLng && quizResultStatus) {
      L.polyline([lastGuessLatLng, targetLatLng], {
        color: quizResultStatus === "correct" ? "#16a34a" : "#f97316",
        dashArray: "7 8",
        opacity: 0.86,
        pane: QUIZ_PANE,
        weight: 2.5,
      }).addTo(quizLayer);
    }

    if (targetLatLng && quizShowTargetPoint) {
      const markerType = quizPromptTarget && !quizResultStatus ? "prompt" : "answer";

      L.marker(targetLatLng, {
        icon: createQuizIcon(markerType, quizResultStatus),
        keyboard: false,
        pane: QUIZ_PANE,
      })
        .bindTooltip(
          markerType === "prompt" ? "Soru noktası" : `${quizTargetName} · Doğru konum`,
          {
            direction: "top",
            offset: [0, -2],
            opacity: 0.96,
          },
        )
        .addTo(quizLayer)
        .openTooltip();
    }

    if (mapOptionLatLngs.length > 0) {
      map.flyToBounds(L.latLngBounds(mapOptionLatLngs), {
        duration: 0.55,
        maxZoom: 7,
        padding: [80, 80],
      });
    } else if (lastGuessLatLng && targetLatLng && quizResultStatus) {
      map.flyToBounds(L.latLngBounds([lastGuessLatLng, targetLatLng]), {
        duration: 0.8,
        maxZoom: quizResultStatus === "correct" ? 8 : 7,
        padding: [80, 80],
      });
    } else if (targetLatLng && quizPromptTarget) {
      map.flyTo(targetLatLng, Math.max(map.getZoom(), 6), {
        duration: 0.45,
      });
    } else if (lastGuessLatLng) {
      map.flyTo(lastGuessLatLng, Math.max(map.getZoom(), 6), {
        duration: 0.35,
      });
    }

    quizLayerRef.current = quizLayer;

    return () => {
      quizLayer.remove();
    };
  }, [
    quizCorrectOptionIds,
    quizGuessPoints,
    quizMapOptions,
    quizPromptTarget,
    quizResultStatus,
    quizSelectedOptionId,
    quizShowTargetPoint,
    quizTargetName,
    quizTargetPoint,
  ]);

  return <div ref={containerRef} className="turkey-map" aria-label="Türkiye fiziki coğrafya haritası" />;
}
