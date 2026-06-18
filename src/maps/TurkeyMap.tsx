import { useEffect, useRef } from "react";
import L, { type LatLngBoundsExpression, type Layer, type LeafletMouseEvent } from "leaflet";
import type { Feature, FeatureCollection, GeoJsonProperties } from "geojson";

type TurkeyMapProps = {
  countryData: FeatureCollection | null;
  provincesData: FeatureCollection | null;
  selectedProvinceName: string | null;
  onProvinceSelect: (provinceName: string) => void;
};

type ProvinceLayer = Layer & {
  feature?: Feature;
};

const TURKEY_BOUNDS: LatLngBoundsExpression = [
  [35.45, 25.2],
  [42.35, 45.3],
];

function getShapeName(properties: GeoJsonProperties | null | undefined) {
  const shapeName = properties?.shapeName;
  return typeof shapeName === "string" ? shapeName : "Bilinmeyen il";
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

export function TurkeyMap({
  countryData,
  provincesData,
  selectedProvinceName,
  onProvinceSelect,
}: TurkeyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const countryLayerRef = useRef<L.GeoJSON | null>(null);
  const provinceLayerRef = useRef<L.GeoJSON | null>(null);
  const selectedProvinceRef = useRef<string | null>(selectedProvinceName);

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

  return <div ref={containerRef} className="turkey-map" aria-label="Türkiye il sınırları haritası" />;
}
