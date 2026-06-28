import type { FeatureCollection, Geometry } from "geojson";
import { provinceNeighbors } from "../geojson/provinceNeighbors";
import type { PlusPoint, ProvinceQuizInfo } from "./plusQuestionEngine";

/**
 * İl GeoJSON'unu + komşuluk haritasını il tahmin modunun (Soru+) ihtiyaç
 * duyduğu saf girdiye dönüştürür. Yan etki yok.
 */

type Ring = number[][];

function ringSignedArea(ring: Ring) {
  let area = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index];
    const [x1, y1] = ring[index + 1];

    area += x0 * y1 - x1 * y0;
  }

  return area / 2;
}

function ringCentroid(ring: Ring): { point: PlusPoint; area: number } {
  const area = ringSignedArea(ring);

  if (area === 0) {
    // Dejenere halka: köşelerin ortalamasını al.
    const total = ring.reduce(
      (sum, [lng, lat]) => ({ lng: sum.lng + lng, lat: sum.lat + lat }),
      { lng: 0, lat: 0 },
    );
    const count = Math.max(ring.length, 1);

    return { point: { lat: total.lat / count, lng: total.lng / count }, area: 0 };
  }

  let cx = 0;
  let cy = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index];
    const [x1, y1] = ring[index + 1];
    const cross = x0 * y1 - x1 * y0;

    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  return { point: { lat: cy / (6 * area), lng: cx / (6 * area) }, area: Math.abs(area) };
}

/** Poligon/MultiPoligon'un en büyük dış halkasının ağırlık merkezini döndürür. */
function geometryCentroid(geometry: Geometry): PlusPoint | null {
  const outerRings: Ring[] =
    geometry.type === "Polygon"
      ? [geometry.coordinates[0]]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates.map((polygon) => polygon[0])
        : [];

  let best: { point: PlusPoint; area: number } | null = null;

  for (const ring of outerRings) {
    if (!ring || ring.length < 3) {
      continue;
    }

    const candidate = ringCentroid(ring);

    if (!best || candidate.area > best.area) {
      best = candidate;
    }
  }

  return best?.point ?? null;
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

    const point = geometryCentroid(feature.geometry);

    if (!point) {
      continue;
    }

    result.push({
      id: getProvinceId(feature.properties, name),
      name,
      point,
      neighbors: provinceNeighbors[name] ?? [],
    });
  }

  return result;
}
