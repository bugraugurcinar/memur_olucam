import { useEffect, useRef } from "react";
import L, { type LatLngBoundsExpression, type Layer, type LeafletMouseEvent } from "leaflet";
import type { Feature, FeatureCollection, GeoJsonProperties } from "geojson";
import {
  getPhysicalFeatureTopic,
  isPhysicalFeature,
  type PhysicalFeatureCategory,
  type PhysicalFeatureProperties,
  type PhysicalFeatureTopic,
} from "../geojson/physicalFeatures";

type TurkeyMapProps = {
  countryData: FeatureCollection | null;
  provincesData: FeatureCollection | null;
  physicalFeaturesData: FeatureCollection | null;
  activePhysicalTopics: PhysicalFeatureTopic[];
  activePhysicalCategories: PhysicalFeatureCategory[];
  selectedProvinceName: string | null;
  selectedPhysicalFeatureId: string | null;
  onProvinceSelect: (provinceName: string) => void;
  onPhysicalFeatureSelect: (feature: PhysicalFeatureProperties) => void;
};

type ProvinceLayer = Layer & {
  feature?: Feature;
};

type PhysicalFeatureLayer = Layer & {
  feature?: Feature;
};

const TURKEY_BOUNDS: LatLngBoundsExpression = [
  [35.45, 25.2],
  [42.35, 45.3],
];
const PHYSICAL_FEATURE_PANE = "physical-feature-pane";

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
): L.CircleMarkerOptions {
  const topic = getPhysicalFeatureTopic(feature.topic);
  const isSelected = feature.id === selectedFeatureId;

  return {
    pane: PHYSICAL_FEATURE_PANE,
    radius: isSelected ? 8 : 5.5,
    color: isSelected ? "#fbbf24" : "#ffffff",
    fillColor: topic.color,
    fillOpacity: isSelected ? 0.96 : 0.82,
    opacity: 1,
    weight: isSelected ? 2.5 : 1.4,
  };
}

export function TurkeyMap({
  countryData,
  provincesData,
  physicalFeaturesData,
  activePhysicalTopics,
  activePhysicalCategories,
  selectedProvinceName,
  selectedPhysicalFeatureId,
  onProvinceSelect,
  onPhysicalFeatureSelect,
}: TurkeyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const countryLayerRef = useRef<L.GeoJSON | null>(null);
  const provinceLayerRef = useRef<L.GeoJSON | null>(null);
  const physicalFeatureLayerRef = useRef<L.GeoJSON | null>(null);
  const selectedProvinceRef = useRef<string | null>(selectedProvinceName);
  const selectedFeatureRef = useRef<string | null>(selectedPhysicalFeatureId);

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
    const physicalFeaturePane = map.getPane(PHYSICAL_FEATURE_PANE);

    if (physicalFeaturePane) {
      physicalFeaturePane.style.zIndex = "625";
      physicalFeaturePane.style.pointerEvents = "auto";
    }

    map.fitBounds(TURKEY_BOUNDS, { padding: [18, 18] });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    selectedProvinceRef.current = selectedProvinceName;

    provinceLayerRef.current?.eachLayer((layer: ProvinceLayer) => {
      const provinceName = getShapeName(layer.feature?.properties);

      if (layer instanceof L.Path) {
        layer.setStyle(provinceStyle(provinceName, selectedProvinceName));
      }
    });
  }, [selectedProvinceName]);

  useEffect(() => {
    selectedFeatureRef.current = selectedPhysicalFeatureId;

    physicalFeatureLayerRef.current?.eachLayer((layer: PhysicalFeatureLayer) => {
      const feature = layer.feature;

      if (feature && isPhysicalFeature(feature) && layer instanceof L.CircleMarker) {
        layer.setStyle(physicalFeatureStyle(feature.properties, selectedPhysicalFeatureId));
        layer.setRadius(feature.properties.id === selectedPhysicalFeatureId ? 8 : 5.5);
      }
    });
  }, [selectedPhysicalFeatureId]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !countryData || !provincesData) {
      return;
    }

    countryLayerRef.current?.remove();
    provinceLayerRef.current?.remove();

    const countryLayer = L.geoJSON(countryData, {
      interactive: false,
      style: countryStyle,
    }).addTo(map);

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

    countryLayerRef.current = countryLayer;
    provinceLayerRef.current = provinceLayer;

    map.fitBounds(countryLayer.getBounds(), { padding: [24, 24], maxZoom: 7 });

    return () => {
      countryLayer.remove();
      provinceLayer.remove();
    };
  }, [countryData, provincesData, onProvinceSelect]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !physicalFeaturesData) {
      return;
    }

    physicalFeatureLayerRef.current?.remove();

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
              layer.setStyle(physicalFeatureStyle(physicalFeature, selectedFeatureRef.current));
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
          return L.circleMarker(latlng, physicalFeatureStyle(feature.properties, selectedFeatureRef.current));
        }

        return L.circleMarker(latlng);
      },
    }).addTo(map);

    physicalFeatureLayerRef.current = physicalFeatureLayer;

    return () => {
      physicalFeatureLayer.remove();
    };
  }, [physicalFeaturesData, activePhysicalCategories, activePhysicalTopics, onPhysicalFeatureSelect]);

  return <div ref={containerRef} className="turkey-map" aria-label="Türkiye fiziki coğrafya haritası" />;
}
