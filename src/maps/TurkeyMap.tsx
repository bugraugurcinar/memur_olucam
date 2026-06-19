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
import type { PlusMapTarget } from "../quiz/plusQuestionEngine";

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
  isPlusActive: boolean;
  quizGuessPoints: QuizPoint[];
  quizResultStatus: QuizResultStatus;
  quizTargetName: string;
  quizTargetPoint: QuizPoint | null;
  quizShowTargetPoint: boolean;
  quizPromptTarget: boolean;
  quizMapOptions: QuizMapOption[];
  quizSelectedOptionId: string | null;
  quizCorrectOptionIds: string[];
  quizSelectedLineOptionIds: string[];
  quizCorrectLineOptionIds: string[];
  plusTargets: PlusMapTarget[];
  plusSelectedTargetIds: string[];
  plusCorrectTargetIds: string[];
  plusWrongTargetIds: string[];
  plusAssignedTokenLabels: Record<string, string>;
  plusResultStatus: QuizResultStatus;
  onProvinceSelect: (provinceName: string) => void;
  onPhysicalFeatureSelect: (feature: PhysicalFeatureProperties) => void;
  onEconomicFeatureSelect: (feature: EconomicFeatureProperties) => void;
  onQuizGuess: (point: QuizPoint) => void;
  onQuizOptionSelect: (optionId: string) => void;
  onPlusTargetSelect: (targetId: string) => void;
  onPlusTargetDrop: (targetId: string, tokenId: string) => void;
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

type FeatureMarker = L.Marker & {
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

function getPhysicalIconName(feature: PhysicalFeatureProperties) {
  if (feature.topic === "mountain" && feature.category === "mountain_volcanic") {
    return "volcano";
  }

  const icons: Record<PhysicalFeatureTopic, string> = {
    mountain: "mountain",
    plain: "field",
    plateau: "layers",
    river: "river",
    lake: "lake",
    coast: "coast",
  };

  return icons[feature.topic];
}

function getEconomicIconName(feature: EconomicFeatureProperties) {
  if (feature.category === "energy_hydroelectric") {
    return "hydro";
  }

  if (feature.category === "energy_geothermal" || feature.category === "energy_fossil") {
    return "flame";
  }

  if (feature.category === "energy_wind") {
    return "wind";
  }

  if (feature.category === "energy_solar") {
    return "sun";
  }

  const icons: Record<EconomicFeatureTopic, string> = {
    agriculture: "leaf",
    livestock: "barn",
    mine: "pickaxe",
    energy: "bolt",
    industry: "factory",
    tourism: "camera",
    port: "anchor",
  };

  return icons[feature.topic];
}

function featureIconSvg(iconName: string) {
  const common = `fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"`;
  const icons: Record<string, string> = {
    anchor: `<path ${common} d="M12 4v16" /><path ${common} d="M7 8h10" /><path ${common} d="M5 14c1 4 4 6 7 6s6-2 7-6" /><path ${common} d="M5 14h3" /><path ${common} d="M16 14h3" /><circle ${common} cx="12" cy="4" r="2" />`,
    barn: `<path ${common} d="M4 20V9l8-5 8 5v11" /><path ${common} d="M8 20v-7h8v7" /><path ${common} d="M9 9h6" /><path ${common} d="M12 13v7" />`,
    bolt: `<path ${common} d="M13 2 5 14h6l-1 8 9-13h-6l1-7Z" />`,
    camera: `<path ${common} d="M5 8h3l2-2h4l2 2h3v11H5Z" /><circle ${common} cx="12" cy="13.5" r="3" />`,
    coast: `<path ${common} d="M4 9c4-3 8 3 12 0 2-1 3-1 4 0" /><path ${common} d="M4 15c4-3 8 3 12 0 2-1 3-1 4 0" />`,
    factory: `<path ${common} d="M4 20V9l5 3V9l5 3V7h6v13Z" /><path ${common} d="M8 17h1" /><path ${common} d="M12 17h1" /><path ${common} d="M16 17h1" />`,
    field: `<path ${common} d="M4 18h16" /><path ${common} d="M5 14c4-3 10-3 14 0" /><path ${common} d="M6 10c3-2 9-2 12 0" /><path ${common} d="M8 6c2-1 6-1 8 0" />`,
    flame: `<path ${common} d="M12 22c4 0 7-3 7-7 0-3-2-5-5-8 0 3-2 4-4 5 0-2-1-4-3-5 0 4-2 6-2 8 0 4 3 7 7 7Z" />`,
    hydro: `<path ${common} d="M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11Z" /><path ${common} d="M8 18c2-1 6-1 8 0" />`,
    lake: `<path ${common} d="M4 15c2-2 4-2 6 0s4 2 6 0 3-2 4-1" /><path ${common} d="M5 19c2-2 4-2 6 0s4 2 6 0" /><path ${common} d="M12 4s4 4 4 7a4 4 0 0 1-8 0c0-3 4-7 4-7Z" />`,
    layers: `<path ${common} d="m12 3 9 5-9 5-9-5 9-5Z" /><path ${common} d="m3 12 9 5 9-5" /><path ${common} d="m3 16 9 5 9-5" />`,
    leaf: `<path ${common} d="M5 19c8 0 14-6 14-14C11 5 5 11 5 19Z" /><path ${common} d="M5 19 15 9" />`,
    mountain: `<path ${common} d="m3 19 7-12 4 7 2-3 5 8H3Z" /><path ${common} d="m10 7 1.8 3h-3.6L10 7Z" />`,
    pickaxe: `<path ${common} d="M14 5c3 1 5 3 6 6" /><path ${common} d="M4 20 14 10" /><path ${common} d="M9 5c4-2 8-1 11 2" />`,
    river: `<path ${common} d="M6 3c5 3 1 6 6 9s1 6 6 9" /><path ${common} d="M3 15c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />`,
    sun: `<circle ${common} cx="12" cy="12" r="4" /><path ${common} d="M12 2v2" /><path ${common} d="M12 20v2" /><path ${common} d="M4 12H2" /><path ${common} d="M22 12h-2" /><path ${common} d="m5 5 1.5 1.5" /><path ${common} d="m17.5 17.5 1.5 1.5" /><path ${common} d="m19 5-1.5 1.5" /><path ${common} d="m6.5 17.5L5 19" />`,
    volcano: `<path ${common} d="m3 20 7-14 3 7 2-3 6 10H3Z" /><path ${common} d="M10 6c-1-2 2-2 1-4" /><path ${common} d="M13 7c2-1-1-3 1-5" /><path ${common} d="M9 13h6" />`,
    wind: `<path ${common} d="M3 8h11a3 3 0 1 0-3-3" /><path ${common} d="M3 13h15a3 3 0 1 1-3 3" /><path ${common} d="M3 18h7" />`,
  };

  return icons[iconName] ?? icons.bolt;
}

function createFeatureIcon({
  color,
  iconName,
  isEconomic,
  isSelected,
}: {
  color: string;
  iconName: string;
  isEconomic: boolean;
  isSelected: boolean;
}) {
  const selectedClass = isSelected ? " feature-map-marker--selected" : "";
  const economicClass = isEconomic ? " feature-map-marker--economic" : " feature-map-marker--physical";

  return L.divIcon({
    className: `feature-map-marker${economicClass}${selectedClass}`,
    html: `<span style="--feature-color: ${color}"><svg viewBox="0 0 24 24" aria-hidden="true">${featureIconSvg(iconName)}</svg></span>`,
    iconAnchor: [15, 15],
    iconSize: [30, 30],
  });
}

function createPhysicalFeatureIcon(
  feature: PhysicalFeatureProperties,
  selectedFeatureId: string | null,
  shouldUseCategoryColors: boolean,
) {
  return createFeatureIcon({
    color: getPhysicalFeatureColor(feature, shouldUseCategoryColors),
    iconName: getPhysicalIconName(feature),
    isEconomic: false,
    isSelected: feature.id === selectedFeatureId,
  });
}

function createEconomicFeatureIcon(
  feature: EconomicFeatureProperties,
  selectedFeatureId: string | null,
  shouldUseCategoryColors: boolean,
) {
  return createFeatureIcon({
    color: getEconomicFeatureColor(feature, shouldUseCategoryColors),
    iconName: getEconomicIconName(feature),
    isEconomic: true,
    isSelected: feature.id === selectedFeatureId,
  });
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

function createPlusIcon(
  target: PlusMapTarget,
  resultStatus: QuizResultStatus,
  isSelected: boolean,
  assignedLabel?: string,
) {
  const statusClass = resultStatus ? ` quiz-map-marker--${resultStatus}` : "";
  const selectedClass = isSelected ? " plus-map-marker--selected" : "";
  const assignedClass = assignedLabel ? " plus-map-marker--assigned" : "";

  return L.divIcon({
    className: `quiz-map-marker plus-map-marker${statusClass}${selectedClass}${assignedClass}`,
    html: `<span style="--plus-color: ${target.color}"><b>${escapeHtml(target.label)}</b>${
      assignedLabel ? `<em>${escapeHtml(assignedLabel)}</em>` : ""
    }</span>`,
    iconAnchor: [18, 18],
    iconSize: [36, 36],
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
  isPlusActive,
  quizGuessPoints,
  quizResultStatus,
  quizTargetName,
  quizTargetPoint,
  quizShowTargetPoint,
  quizPromptTarget,
  quizMapOptions,
  quizSelectedOptionId,
  quizCorrectOptionIds,
  quizSelectedLineOptionIds,
  quizCorrectLineOptionIds,
  plusTargets,
  plusSelectedTargetIds,
  plusCorrectTargetIds,
  plusWrongTargetIds,
  plusAssignedTokenLabels,
  plusResultStatus,
  onProvinceSelect,
  onPhysicalFeatureSelect,
  onEconomicFeatureSelect,
  onQuizGuess,
  onQuizOptionSelect,
  onPlusTargetSelect,
  onPlusTargetDrop,
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
  const onPlusTargetSelectRef = useRef(onPlusTargetSelect);
  const onPlusTargetDropRef = useRef(onPlusTargetDrop);
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
    onPlusTargetSelectRef.current = onPlusTargetSelect;
    onPlusTargetDropRef.current = onPlusTargetDrop;
  }, [isQuizActive, onPlusTargetDrop, onPlusTargetSelect, onQuizGuess, onQuizOptionSelect]);

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
    const isQuestionActive = isQuizActive || isPlusActive;

    provinceLayerRef.current?.eachLayer((layer: ProvinceLayer) => {
      const provinceName = getShapeName(layer.feature?.properties);

      if (layer instanceof L.Path) {
        layer.setStyle(isQuestionActive ? quizProvinceStyle() : provinceStyle(provinceName, selectedProvinceName));
      }
    });
  }, [isPlusActive, isQuizActive, selectedProvinceName]);

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

    if ((isQuizActive || isPlusActive) && provincesData) {
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
  }, [countryData, provincesData, isPlusActive, isQuizActive, onProvinceSelect]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !physicalFeaturesData) {
      return;
    }

    physicalFeatureLayerRef.current?.remove();
    physicalFeatureLayerRef.current = null;

    if (isQuizActive || isPlusActive) {
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
    isPlusActive,
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

    if (isQuizActive || isPlusActive) {
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
    isPlusActive,
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
    const plusTargetLatLngs = plusTargets.map((target) => L.latLng(target.point.lat, target.point.lng));
    const optionLatLngById = new Map<string, L.LatLng>();

    quizMapOptions.forEach((option) => {
      const optionLatLng = L.latLng(option.point.lat, option.point.lng);

      optionLatLngById.set(option.id, optionLatLng);
      optionLatLngById.set(option.label, optionLatLng);
    });
    const guessLatLngs = quizGuessPoints.map((point) => L.latLng(point.lat, point.lng));
    const lastGuessLatLng = guessLatLngs[guessLatLngs.length - 1] ?? null;
    const targetLatLng = quizTargetPoint ? L.latLng(quizTargetPoint.lat, quizTargetPoint.lng) : null;
    const fallbackSelectedLineIds =
      quizSelectedLineOptionIds.length === 0 && quizSelectedOptionId?.includes("|")
        ? quizSelectedOptionId.split("|")
        : quizSelectedLineOptionIds;
    const fallbackCorrectLineIds =
      quizCorrectLineOptionIds.length === 0 && quizCorrectOptionIds[0]?.includes("|")
        ? quizCorrectOptionIds[0].split("|")
        : quizCorrectLineOptionIds;

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

    plusTargets.forEach((target) => {
      const targetLatLng = L.latLng(target.point.lat, target.point.lng);
      const isCorrectTarget = plusCorrectTargetIds.includes(target.id);
      const isWrongTarget = plusWrongTargetIds.includes(target.id);
      const isSelectedTarget = plusSelectedTargetIds.includes(target.id);
      const assignedLabel = plusAssignedTokenLabels[target.id];
      const targetStatus: QuizResultStatus = plusResultStatus
        ? isWrongTarget
          ? "wrong"
          : isCorrectTarget
            ? "correct"
            : null
        : null;
      const marker = L.marker(targetLatLng, {
        bubblingMouseEvents: false,
        icon: createPlusIcon(target, targetStatus, isSelectedTarget, assignedLabel),
        keyboard: true,
        pane: QUIZ_PANE,
      })
        .bindTooltip(
          plusResultStatus
            ? `${target.label}: ${target.name} · ${target.detail}`
            : assignedLabel
              ? `${target.label}: ${assignedLabel}`
              : `${target.label} hedefi`,
          {
            direction: "top",
            opacity: 0.96,
          },
        )
        .addTo(quizLayer);

      if (!plusResultStatus) {
        marker.on("click", () => onPlusTargetSelectRef.current(target.id));

        const element = marker.getElement();

        if (element) {
          element.addEventListener("dragover", (event) => {
            event.preventDefault();
          });
          element.addEventListener("drop", (event) => {
            event.preventDefault();
            const tokenId = event.dataTransfer?.getData("text/plain");

            if (tokenId) {
              onPlusTargetDropRef.current(target.id, tokenId);
            }
          });
        }
      }

      if (plusResultStatus && (isCorrectTarget || isWrongTarget)) {
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

    const selectedLineLatLngs = fallbackSelectedLineIds
      .map((optionId) => optionLatLngById.get(optionId))
      .filter((latLng): latLng is L.LatLng => Boolean(latLng));
    const correctLineLatLngs = fallbackCorrectLineIds
      .map((optionId) => optionLatLngById.get(optionId))
      .filter((latLng): latLng is L.LatLng => Boolean(latLng));

    if (selectedLineLatLngs.length > 1) {
      L.polyline(selectedLineLatLngs, {
        color: quizResultStatus === "correct" ? "#16a34a" : "#f97316",
        dashArray: quizResultStatus === "correct" ? undefined : "7 8",
        opacity: 0.9,
        pane: QUIZ_PANE,
        weight: 3,
      }).addTo(quizLayer);
    }

    if (
      correctLineLatLngs.length > 1 &&
      fallbackCorrectLineIds.join("|") !== fallbackSelectedLineIds.join("|")
    ) {
      L.polyline(correctLineLatLngs, {
        color: "#16a34a",
        opacity: 0.92,
        pane: QUIZ_PANE,
        weight: 3,
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
    } else if (plusTargetLatLngs.length > 0) {
      map.flyToBounds(L.latLngBounds(plusTargetLatLngs), {
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
    plusAssignedTokenLabels,
    plusCorrectTargetIds,
    plusResultStatus,
    plusSelectedTargetIds,
    plusTargets,
    plusWrongTargetIds,
    quizCorrectOptionIds,
    quizCorrectLineOptionIds,
    quizGuessPoints,
    quizMapOptions,
    quizPromptTarget,
    quizResultStatus,
    quizSelectedLineOptionIds,
    quizSelectedOptionId,
    quizShowTargetPoint,
    quizTargetName,
    quizTargetPoint,
  ]);

  return <div ref={containerRef} className="turkey-map" aria-label="Türkiye fiziki coğrafya haritası" />;
}
