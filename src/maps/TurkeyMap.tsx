import { useEffect, useRef } from "react";
import L, { type LatLngBoundsExpression, type Layer, type LeafletMouseEvent } from "leaflet";
import type { Feature, FeatureCollection, GeoJsonProperties } from "geojson";
import { getEconomicFeatureIconName, getPhysicalFeatureIconName } from "../geojson/featureIcons";
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

type QuizResultStatus = "correct" | "wrong" | null;

type ProvinceHighlightStatus = "correct" | "wrong" | "option";

export type ProvinceHighlight = {
  name: string;
  status: ProvinceHighlightStatus;
};

export type DistrictHighlight = {
  id: string;
  status: ProvinceHighlightStatus;
};

type TurkeyMapProps = {
  countryData: FeatureCollection | null;
  provincesData: FeatureCollection | null;
  districtsData: FeatureCollection | null;
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
  isPlusActive: boolean;
  isPlusMapLocateActive: boolean;
  plusHideProvinces: boolean;
  plusHighlightProvinces: ProvinceHighlight[];
  plusHighlightDistricts: DistrictHighlight[];
  plusMapLocateDistrictTargetId: string | null;
  plusGuessPoints: QuizPoint[];
  plusMapLocateTargetName: string;
  plusMapLocateTargetPoint: QuizPoint | null;
  plusMapLocateShowTargetPoint: boolean;
  plusTargets: PlusMapTarget[];
  plusSelectedTargetIds: string[];
  plusCorrectTargetIds: string[];
  plusWrongTargetIds: string[];
  plusAssignedTokenLabels: Record<string, string>;
  plusResultStatus: QuizResultStatus;
  onProvinceSelect: (provinceName: string) => void;
  onPhysicalFeatureSelect: (feature: PhysicalFeatureProperties) => void;
  onEconomicFeatureSelect: (feature: EconomicFeatureProperties) => void;
  onPlusMapGuess: (point: QuizPoint) => void;
  onPlusTargetSelect: (targetId: string) => void;
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
// Pan sınırı, Türkiye'den özellikle GÜNEYE doğru geniş tutulur: dikey telefon
// ekranında alt sayfa (soru kartı) haritanın altını kapattığından, soru
// hedeflerini görünür alana getirmek için haritanın yukarı kaydırılabilmesi
// gerekir — sıkı bounds bunu Leaflet'in merkez kelepçesiyle engelliyordu.
const PAN_BOUNDS: LatLngBoundsExpression = [
  [27.5, 22.0],
  [44.5, 48.5],
];
const PHYSICAL_FEATURE_PANE = "physical-feature-pane";
const ECONOMIC_FEATURE_PANE = "economic-feature-pane";
const QUIZ_PANE = "quiz-pane";
const QUESTION_MARKER_COLOR = "#10b981";

function getShapeName(properties: GeoJsonProperties | null | undefined) {
  const shapeName = properties?.shapeName;
  return typeof shapeName === "string" ? shapeName : "Bilinmeyen il";
}

function getDistrictShapeId(properties: GeoJsonProperties | null | undefined) {
  const shapeID = properties?.shapeID;
  return typeof shapeID === "string" && shapeID.length > 0 ? `district_${shapeID}` : null;
}

function getDistrictShapeName(properties: GeoJsonProperties | null | undefined) {
  const shapeName = properties?.shapeName;
  return typeof shapeName === "string" ? shapeName : "Bilinmeyen ilçe";
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
    color: isSelected ? "#facc15" : "#34d399",
    fillColor: isSelected ? "#fde047" : "#34d399",
    fillOpacity: isSelected ? 0.42 : 0.1,
    opacity: isSelected ? 0.95 : 0.5,
    weight: isSelected ? 2.5 : 1,
  };
}

function quizProvinceStyle(): L.PathOptions {
  return {
    color: "#34d399",
    fillColor: "#34d399",
    fillOpacity: 0.06,
    opacity: 0.4,
    weight: 0.8,
  };
}

function highlightProvinceStyle(status: ProvinceHighlightStatus): L.PathOptions {
  if (status === "correct") {
    return {
      color: "#16a34a",
      fillColor: "#4ade80",
      fillOpacity: 0.5,
      opacity: 0.95,
      weight: 2.6,
    };
  }

  if (status === "wrong") {
    return {
      color: "#e11d48",
      fillColor: "#fb7185",
      fillOpacity: 0.42,
      opacity: 0.95,
      weight: 2.4,
    };
  }

  // Diğer şık illeri: konumu gösteren nötr vurgu.
  return {
    color: "#94a3b8",
    fillColor: "#cbd5e1",
    fillOpacity: 0.28,
    opacity: 0.85,
    weight: 1.8,
  };
}

function countryStyle(): L.PathOptions {
  return {
    color: "#34d399",
    fillOpacity: 0,
    opacity: 0.5,
    weight: 2.4,
  };
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
  const iconSize = isSelected ? 34 : 30;

  return L.divIcon({
    className: `feature-map-marker${economicClass}${selectedClass}`,
    html: `<span style="--feature-color: ${color}"><svg viewBox="0 0 24 24" aria-hidden="true">${featureIconSvg(iconName)}</svg></span>`,
    iconAnchor: [iconSize / 2, iconSize / 2],
    iconSize: [iconSize, iconSize],
  });
}

function createPhysicalFeatureIcon(
  feature: PhysicalFeatureProperties,
  selectedFeatureId: string | null,
  shouldUseCategoryColors: boolean,
) {
  return createFeatureIcon({
    color: getPhysicalFeatureColor(feature, shouldUseCategoryColors),
    iconName: getPhysicalFeatureIconName(feature),
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
    iconName: getEconomicFeatureIconName(feature),
    isEconomic: true,
    isSelected: feature.id === selectedFeatureId,
  });
}

function getSharedMarkerIconName(markers: Array<{ markerIconName: string }>) {
  const firstIconName = markers[0]?.markerIconName;

  return firstIconName && markers.every((marker) => marker.markerIconName === firstIconName)
    ? firstIconName
    : null;
}

function createQuizIcon(
  markerType: "guess" | "answer",
  resultStatus: QuizResultStatus = null,
  label?: string,
  iconName?: string | null,
) {
  const markerClass = markerType === "guess" ? "quiz-guess-marker" : "quiz-answer-marker";
  const statusClass = resultStatus ? ` quiz-map-marker--${resultStatus}` : "";
  const iconClass = iconName ? " quiz-map-marker--with-icon" : "";
  const markerLabel = label ?? (markerType === "guess" ? "T" : "D");

  return L.divIcon({
    className: `quiz-map-marker ${markerClass}${statusClass}${iconClass}`,
    html: `<span>${
      iconName ? `<svg viewBox="0 0 24 24" aria-hidden="true">${featureIconSvg(iconName)}</svg>` : ""
    }<b>${markerLabel}</b></span>`,
    iconAnchor: [15, 15],
    iconSize: [30, 30],
  });
}

function createPlusIcon(
  target: PlusMapTarget,
  resultStatus: QuizResultStatus,
  isSelected: boolean,
  assignedLabel?: string,
  iconName?: string | null,
) {
  const statusClass = resultStatus ? ` quiz-map-marker--${resultStatus}` : "";
  const selectedClass = isSelected ? " plus-map-marker--selected" : "";
  const assignedClass = assignedLabel ? " plus-map-marker--assigned" : "";
  const iconClass = iconName ? " plus-map-marker--with-icon" : "";

  return L.divIcon({
    className: `quiz-map-marker plus-map-marker${statusClass}${selectedClass}${assignedClass}${iconClass}`,
    html: `<span style="--plus-color: ${QUESTION_MARKER_COLOR}">${
      iconName ? `<svg viewBox="0 0 24 24" aria-hidden="true">${featureIconSvg(iconName)}</svg>` : ""
    }<b>${escapeHtml(target.label)}</b>${
      assignedLabel ? `<em>${escapeHtml(assignedLabel)}</em>` : ""
    }</span>`,
    iconAnchor: [18, 18],
    iconSize: [36, 36],
  });
}

export function TurkeyMap({
  countryData,
  provincesData,
  districtsData,
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
  isPlusActive,
  isPlusMapLocateActive,
  plusHideProvinces,
  plusHighlightProvinces,
  plusHighlightDistricts,
  plusMapLocateDistrictTargetId,
  plusGuessPoints,
  plusMapLocateTargetName,
  plusMapLocateTargetPoint,
  plusMapLocateShowTargetPoint,
  plusTargets,
  plusSelectedTargetIds,
  plusCorrectTargetIds,
  plusWrongTargetIds,
  plusAssignedTokenLabels,
  plusResultStatus,
  onProvinceSelect,
  onPhysicalFeatureSelect,
  onEconomicFeatureSelect,
  onPlusMapGuess,
  onPlusTargetSelect,
}: TurkeyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const countryLayerRef = useRef<L.GeoJSON | null>(null);
  const provinceLayerRef = useRef<L.GeoJSON | null>(null);
  const districtLayerRef = useRef<L.GeoJSON | null>(null);
  const physicalFeatureLayerRef = useRef<L.GeoJSON | null>(null);
  const economicFeatureLayerRef = useRef<L.GeoJSON | null>(null);
  const quizLayerRef = useRef<L.LayerGroup | null>(null);
  const isPlusMapLocateActiveRef = useRef(isPlusMapLocateActive);
  const onPlusMapGuessRef = useRef(onPlusMapGuess);
  const onPlusTargetSelectRef = useRef(onPlusTargetSelect);
  const selectedProvinceRef = useRef<string | null>(selectedProvinceName);
  const selectedFeatureRef = useRef<string | null>(selectedPhysicalFeatureId);
  const selectedEconomicFeatureRef = useRef<string | null>(selectedEconomicFeatureId);
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      attributionControl: false,
      maxBounds: PAN_BOUNDS,
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

    // Uzak zoom'da (tüm Türkiye görünümü) yüzlerce marker dar telefon
    // ekranında üst üste binip haritayı örtüyor — container'a sınıf verip
    // CSS ile küçültüyoruz (bkz. .turkey-map--far).
    const container = containerRef.current;
    const updateZoomClass = () => {
      container.classList.toggle("turkey-map--far", map.getZoom() <= 5);
    };
    // moveend de dinlenir: fitBounds zoom'u değiştirmeden yalnızca pan
    // yaptığında zoomend ateşlenmez, sınıf bayat kalırdı.
    map.on("zoomend moveend", updateZoomClass);
    updateZoomClass();

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    isPlusMapLocateActiveRef.current = isPlusMapLocateActive;
    onPlusMapGuessRef.current = onPlusMapGuess;
    onPlusTargetSelectRef.current = onPlusTargetSelect;
  }, [isPlusMapLocateActive, onPlusMapGuess, onPlusTargetSelect]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const handleMapClick = (event: LeafletMouseEvent) => {
      if (!isPlusMapLocateActiveRef.current) {
        return;
      }

      onPlusMapGuessRef.current({
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

    // İl tahmin modunda il katmanının stilini çizim effekti yönetir (gizleme /
    // doğru ili vurgulama); burada dokunma.
    if (isPlusActive && plusHideProvinces) {
      return;
    }

    provinceLayerRef.current?.eachLayer((layer: ProvinceLayer) => {
      const provinceName = getShapeName(layer.feature?.properties);

      if (layer instanceof L.Path) {
        layer.setStyle(isPlusActive ? quizProvinceStyle() : provinceStyle(provinceName, selectedProvinceName));
      }
    });
  }, [isPlusActive, plusHideProvinces, selectedProvinceName]);

  useEffect(() => {
    selectedFeatureRef.current = selectedPhysicalFeatureId;

    physicalFeatureLayerRef.current?.eachLayer((layer: PhysicalFeatureLayer) => {
      const feature = layer.feature;

      if (feature && isPhysicalFeature(feature) && layer instanceof L.Marker) {
        layer.setIcon(
          createPhysicalFeatureIcon(
            feature.properties,
            selectedPhysicalFeatureId,
            shouldUsePhysicalCategoryColors,
          ),
        );
      }
    });
  }, [selectedPhysicalFeatureId, shouldUsePhysicalCategoryColors]);

  useEffect(() => {
    selectedEconomicFeatureRef.current = selectedEconomicFeatureId;

    economicFeatureLayerRef.current?.eachLayer((layer: EconomicFeatureLayer) => {
      const feature = layer.feature;

      if (feature && isEconomicFeature(feature) && layer instanceof L.Marker) {
        layer.setIcon(
          createEconomicFeatureIcon(
            feature.properties,
            selectedEconomicFeatureId,
            shouldUseEconomicCategoryColors,
          ),
        );
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

    if (isPlusActive && plusHideProvinces) {
      // İl tahmin modu: soru sırasında il sınırlarını gizle; cevaptan sonra
      // tüm şık illerini işaretle (doğru/yanlış/diğer ayrımıyla).
      if (plusHighlightProvinces.length > 0 && provincesData) {
        const statusByName = new Map(
          plusHighlightProvinces.map((highlight) => [highlight.name, highlight.status]),
        );
        const highlightLayer = L.geoJSON(provincesData, {
          filter: (feature) => statusByName.has(getShapeName(feature?.properties)),
          interactive: true,
          onEachFeature: (feature, layer) => {
            const name = getShapeName(feature?.properties);
            const status = statusByName.get(name);

            // Dokunmatikte hover yok: doğru/yanlış iller kalıcı etiket alır;
            // diğer şıklar etiketsiz kalır (adları zaten şık listesinde).
            if (status === "correct" || status === "wrong") {
              layer.bindTooltip(status === "correct" ? `${name} · Doğru il` : name, {
                direction: "top",
                opacity: 0.95,
                permanent: true,
              });
            }
          },
          style: (feature) =>
            highlightProvinceStyle(statusByName.get(getShapeName(feature?.properties)) ?? "option"),
        }).addTo(map);

        provinceLayerRef.current = highlightLayer;
      }
    } else if (isPlusActive && provincesData) {
      const provinceLayer = L.geoJSON(provincesData, {
        interactive: false,
        style: quizProvinceStyle,
      }).addTo(map);

      provinceLayerRef.current = provinceLayer;
    } else if (provincesData) {
      const provinceLayer = L.geoJSON(provincesData, {
        onEachFeature: (feature, layer: ProvinceLayer) => {
          const provinceName = getShapeName(feature.properties);

          // Dokunmatik akış: dokununca il adı popup'ı açılır (hover tooltip yerine);
          // seçili il stili selectedProvinceName effekti tarafından yönetilir.
          layer.bindPopup(escapeHtml(provinceName));
          layer.on("click", () => onProvinceSelect(provinceName));
        },
        style: (feature) => provinceStyle(getShapeName(feature?.properties), selectedProvinceRef.current),
      }).addTo(map);

      provinceLayerRef.current = provinceLayer;
    }

    // Açılışta bir kez ülke geometrisine otur; sonradan (soru başlat/kapat vb.)
    // haritayı yeniden konumlandırma — yalnızca kullanıcı hareket ettirir.
    if (!hasFittedRef.current) {
      map.fitBounds(countryLayer.getBounds(), { padding: [24, 24], maxZoom: 7 });
      hasFittedRef.current = true;
    }

    return () => {
      countryLayer.remove();
      provinceLayerRef.current?.remove();
    };
  }, [
    countryData,
    provincesData,
    isPlusActive,
    plusHideProvinces,
    plusHighlightProvinces,
    onProvinceSelect,
  ]);

  // İlçe katmanı yalnızca "İlçeler" konusu aktifken çizilir — her Soru+
  // sorusunda ~973 poligonu ambient olarak çizmek performans için gereksiz.
  useEffect(() => {
    districtLayerRef.current?.remove();
    districtLayerRef.current = null;

    const map = mapRef.current;

    if (!map || !districtsData) {
      return;
    }

    if (plusHighlightDistricts.length > 0) {
      // İlçe seçmeli soru: cevaptan sonra tüm şık ilçelerini işaretle.
      const statusById = new Map(plusHighlightDistricts.map((highlight) => [highlight.id, highlight.status]));
      const highlightLayer = L.geoJSON(districtsData, {
        filter: (feature) => statusById.has(getDistrictShapeId(feature?.properties) ?? ""),
        interactive: true,
        onEachFeature: (feature, layer) => {
          const id = getDistrictShapeId(feature?.properties);
          const status = id ? statusById.get(id) : undefined;
          const label = getDistrictShapeName(feature?.properties);

          // Dokunmatikte hover yok: doğru/yanlış ilçeler kalıcı etiket alır.
          if (status === "correct" || status === "wrong") {
            layer.bindTooltip(status === "correct" ? `${label} · Doğru ilçe` : label, {
              direction: "top",
              opacity: 0.95,
              permanent: true,
            });
          }
        },
        style: (feature) =>
          highlightProvinceStyle(statusById.get(getDistrictShapeId(feature?.properties) ?? "") ?? "option"),
      }).addTo(map);

      districtLayerRef.current = highlightLayer;
    } else if (plusMapLocateDistrictTargetId) {
      // İlçe haritada bul sorusu: cevaptan sonra doğru ilçenin sınırını göster.
      const revealLayer = L.geoJSON(districtsData, {
        filter: (feature) => getDistrictShapeId(feature?.properties) === plusMapLocateDistrictTargetId,
        interactive: false,
        style: () => highlightProvinceStyle("correct"),
      }).addTo(map);

      districtLayerRef.current = revealLayer;
    }

    return () => {
      districtLayerRef.current?.remove();
    };
  }, [districtsData, plusHighlightDistricts, plusMapLocateDistrictTargetId]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !physicalFeaturesData) {
      return;
    }

    physicalFeatureLayerRef.current?.remove();
    physicalFeatureLayerRef.current = null;

    if (isPlusActive) {
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

        // Dokunmatik akış: dokununca popup açılır; seçili ikon stilini
        // selectedPhysicalFeatureId effekti yönetir (hover ikonu yok).
        layer.bindPopup(
          `<strong>${escapeHtml(physicalFeature.name)}</strong><br />${escapeHtml(
            physicalFeature.topicLabel,
          )}<br />${escapeHtml(physicalFeature.categoryLabel)}<br />${escapeHtml(physicalFeature.region)}`,
        );

        layer.on("click", () => onPhysicalFeatureSelect(physicalFeature));
      },
      pointToLayer: (feature, latlng) => {
        if (isPhysicalFeature(feature)) {
          return L.marker(latlng, {
            icon: createPhysicalFeatureIcon(
              feature.properties,
              selectedFeatureRef.current,
              shouldUsePhysicalCategoryColors,
            ),
            keyboard: true,
            pane: PHYSICAL_FEATURE_PANE,
          });
        }

        return L.marker(latlng, { pane: PHYSICAL_FEATURE_PANE });
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

    if (isPlusActive) {
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

        // Dokunmatik akış: dokununca popup açılır; seçili ikon stilini
        // selectedEconomicFeatureId effekti yönetir (hover ikonu yok).
        layer.bindPopup(
          `<strong>${escapeHtml(economicFeatureDisplayName)}</strong><br />${escapeHtml(
            economicFeature.topicLabel,
          )}<br />${escapeHtml(economicFeature.categoryLabel)}${
            economicFeatureLocationLabel ? `<br />${escapeHtml(economicFeatureLocationLabel)}` : ""
          }`,
        );

        layer.on("click", () => onEconomicFeatureSelect(economicFeature));
      },
      pointToLayer: (feature, latlng) => {
        if (isEconomicFeature(feature)) {
          return L.marker(latlng, {
            icon: createEconomicFeatureIcon(
              feature.properties,
              selectedEconomicFeatureRef.current,
              shouldUseEconomicCategoryColors,
            ),
            keyboard: true,
            pane: ECONOMIC_FEATURE_PANE,
          });
        }

        return L.marker(latlng, { pane: ECONOMIC_FEATURE_PANE });
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
    const plusTargetLatLngs = plusTargets.map((target) => L.latLng(target.point.lat, target.point.lng));
    const safePlusTargetIconName = getSharedMarkerIconName(plusTargets);
    const guessLatLngs = plusGuessPoints.map((point) => L.latLng(point.lat, point.lng));
    const lastGuessLatLng = guessLatLngs[guessLatLngs.length - 1] ?? null;
    const targetLatLng = plusMapLocateTargetPoint
      ? L.latLng(plusMapLocateTargetPoint.lat, plusMapLocateTargetPoint.lng)
      : null;

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
        icon: createPlusIcon(target, targetStatus, isSelectedTarget, assignedLabel, safePlusTargetIconName),
        keyboard: true,
        pane: QUIZ_PANE,
      });

      // Cevaptan sonra doğru/yanlış hedeflere kalıcı etiket; cevap öncesinde
      // etiket yok (harf + atanan jeton zaten marker ikonunun içinde).
      // İl/ilçe vurgusu varsa poligon zaten etiketli — çift etiket bağlama.
      const hasAreaReveal = plusHighlightProvinces.length > 0 || plusHighlightDistricts.length > 0;

      if (plusResultStatus && (isCorrectTarget || isWrongTarget) && !hasAreaReveal) {
        marker.bindTooltip(`${target.label}: ${target.name} · ${target.detail}`, {
          direction: "top",
          opacity: 0.96,
          permanent: true,
        });
      }

      marker.addTo(quizLayer);

      if (!plusResultStatus) {
        // Dokunmatik akış: jetonu seç → hedefe dokun.
        marker.on("click", () => onPlusTargetSelectRef.current(target.id));
      }
    });

    guessLatLngs.forEach((guessLatLng, index) => {
      L.marker(guessLatLng, {
        icon: createQuizIcon("guess", null, guessLatLngs.length > 1 ? `T${index + 1}` : "T"),
        keyboard: false,
        pane: QUIZ_PANE,
      }).addTo(quizLayer);
    });

    if (lastGuessLatLng && targetLatLng && plusResultStatus) {
      L.polyline([lastGuessLatLng, targetLatLng], {
        color: plusResultStatus === "correct" ? "#4ade80" : "#fb7185",
        dashArray: "7 8",
        opacity: 0.86,
        pane: QUIZ_PANE,
        weight: 2.5,
      }).addTo(quizLayer);
    }

    if (targetLatLng && plusMapLocateShowTargetPoint) {
      L.marker(targetLatLng, {
        icon: createQuizIcon("answer", plusResultStatus),
        keyboard: false,
        pane: QUIZ_PANE,
      })
        .bindTooltip(`${plusMapLocateTargetName} · Doğru konum`, {
          direction: "top",
          offset: [0, -2],
          opacity: 0.96,
          permanent: true,
        })
        .addTo(quizLayer);
    }

    quizLayerRef.current = quizLayer;

    return () => {
      // Kalıcı (permanent) tooltip'ler grup kaldırılırken sızabiliyor —
      // effect yeniden çalıştığında kopya birikmemesi için açıkça çöz.
      quizLayer.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          layer.unbindTooltip();
        }
      });
      quizLayer.remove();
    };
  }, [
    plusAssignedTokenLabels,
    plusCorrectTargetIds,
    plusGuessPoints,
    plusHighlightDistricts,
    plusHighlightProvinces,
    plusMapLocateShowTargetPoint,
    plusMapLocateTargetName,
    plusMapLocateTargetPoint,
    plusResultStatus,
    plusSelectedTargetIds,
    plusTargets,
    plusWrongTargetIds,
  ]);

  // Dar dikey ekranda soru hedefleri alt sayfanın (bottom sheet) kapattığı
  // bölgede kalabiliyor; yeni soru geldiğinde hedefleri, sheet'in üstünde
  // kalan alana sığdır. Alt padding, half konumdaki sheet'in kapladığı ~%45'i
  // hesaba katar. Cevap/işaretleme değişimlerinde yeniden oynatmamak için
  // yalnızca hedef kümesi (soru) değişince çalışır.
  const plusTargetsFitKey = plusTargets.map((target) => target.id).join("|");

  useEffect(() => {
    const map = mapRef.current;

    if (!map || plusTargets.length === 0) {
      return;
    }

    const bounds = L.latLngBounds(
      plusTargets.map((target) => [target.point.lat, target.point.lng] as [number, number]),
    );

    map.fitBounds(bounds, {
      maxZoom: 8,
      // Yatay pay, kalıcı tooltip'lerin ekran kenarından taşmasını azaltır.
      paddingTopLeft: [60, 28],
      // Half konumdaki sheet haritanın ~%60'ını kapatır; +44 marker/tooltip payı.
      paddingBottomRight: [60, Math.round(map.getSize().y * 0.6) + 44],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plusTargetsFitKey]);

  // "Haritada bul" cevabı açıklandığında doğru nokta + tahmin çizgisi de
  // sheet'in altında kalmasın.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !plusMapLocateShowTargetPoint || !plusMapLocateTargetPoint) {
      return;
    }

    const points: Array<[number, number]> = [[plusMapLocateTargetPoint.lat, plusMapLocateTargetPoint.lng]];
    for (const guess of plusGuessPoints) {
      points.push([guess.lat, guess.lng]);
    }

    map.fitBounds(L.latLngBounds(points), {
      maxZoom: 8,
      paddingTopLeft: [60, 28],
      paddingBottomRight: [60, Math.round(map.getSize().y * 0.6) + 44],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plusMapLocateShowTargetPoint]);

  return <div ref={containerRef} className="turkey-map" aria-label="Türkiye fiziki coğrafya haritası" />;
}
