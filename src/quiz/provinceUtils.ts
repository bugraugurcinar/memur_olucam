import type { FeatureCollection, Geometry } from "geojson";
import { provinceNeighbors } from "../geojson/provinceNeighbors";
import type { PlusPoint, ProvinceQuizInfo } from "./plusQuestionEngine";
import { ringSignedArea, ringCentroid, samplePinPoints, type Ring } from "./polygonGeometry";

/**
 * İl GeoJSON'unu + komşuluk haritasını il tahmin modunun (Soru+) ihtiyaç
 * duyduğu saf girdiye dönüştürür. Yan etki yok.
 */

type ProvinceGeometrySample = { centroid: PlusPoint; pinPoints: PlusPoint[] };

/** Poligon/MultiPoligon'un en büyük parçasını seçip merkez + pin adaylarını üretir. */
function sampleProvinceGeometry(geometry: Geometry): ProvinceGeometrySample | null {
  const polygons: Ring[][] =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];

  let best: { outer: Ring; holes: Ring[]; area: number } | null = null;

  for (const polygon of polygons) {
    const outer = polygon[0];

    if (!outer || outer.length < 4) {
      continue;
    }

    const area = Math.abs(ringSignedArea(outer));

    if (!best || area > best.area) {
      best = { outer, holes: polygon.slice(1), area };
    }
  }

  if (!best) {
    return null;
  }

  const centroid = ringCentroid(best.outer);

  return { centroid, pinPoints: samplePinPoints(centroid, best.outer, best.holes) };
}

function getShapeName(properties: unknown) {
  const shapeName = (properties as { shapeName?: unknown } | null | undefined)?.shapeName;

  return typeof shapeName === "string" ? shapeName : null;
}

function getProvinceId(properties: unknown, fallback: string) {
  const shapeISO = (properties as { shapeISO?: unknown } | null | undefined)?.shapeISO;

  return typeof shapeISO === "string" && shapeISO.length > 0
    ? `province_${shapeISO}`
    : `province_${fallback}`;
}

export function buildProvinceQuizInfos(
  provincesData: FeatureCollection | null,
): ProvinceQuizInfo[] {
  if (!provincesData) {
    return [];
  }

  const result: ProvinceQuizInfo[] = [];

  for (const feature of provincesData.features) {
    const name = getShapeName(feature.properties);

    if (!name || !feature.geometry) {
      continue;
    }

    const sample = sampleProvinceGeometry(feature.geometry);

    if (!sample) {
      continue;
    }

    result.push({
      id: getProvinceId(feature.properties, name),
      name,
      point: sample.centroid,
      pinPoints: sample.pinPoints,
      neighbors: provinceNeighbors[name] ?? [],
    });
  }

  return result;
}
