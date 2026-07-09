import type { FeatureCollection, Geometry } from "geojson";
import { districtLookup } from "../geojson/districtNeighbors";
import type { DistrictPolygonPart, DistrictQuizInfo, PlusPoint } from "./plusQuestionEngine";
import { ringSignedArea, ringCentroid, isPointInPolygon, samplePinPoints, type Ring } from "./polygonGeometry";

/**
 * İlçe GeoJSON'unu + il/komşuluk eşleme tablosunu ilçe tahmin modunun (Soru+)
 * ihtiyaç duyduğu saf girdiye dönüştürür. Yan etki yok.
 */

type DistrictGeometrySample = {
  centroid: PlusPoint;
  pinPoints: PlusPoint[];
  polygons: DistrictPolygonPart[];
};

/**
 * Tüm poligon parçalarını (poligon-içi kontrolü için) toplar, ancak merkez ve
 * pin adaylarını yalnızca en büyük halkadan üretir — pin'ler küçük bir ayrık
 * parçaya (ör. minik bir ada) düşmesin diye.
 */
function sampleDistrictGeometry(geometry: Geometry): DistrictGeometrySample | null {
  const rawPolygons: Ring[][] =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];

  const polygons: DistrictPolygonPart[] = [];
  let best: { outer: Ring; holes: Ring[]; area: number } | null = null;

  for (const polygon of rawPolygons) {
    const outer = polygon[0];

    if (!outer || outer.length < 4) {
      continue;
    }

    const holes = polygon.slice(1);
    polygons.push({ outer, holes });

    const area = Math.abs(ringSignedArea(outer));

    if (!best || area > best.area) {
      best = { outer, holes, area };
    }
  }

  if (!best || polygons.length === 0) {
    return null;
  }

  const centroid = ringCentroid(best.outer);

  return {
    centroid,
    pinPoints: samplePinPoints(centroid, best.outer, best.holes),
    polygons,
  };
}

function getShapeName(properties: unknown) {
  const shapeName = (properties as { shapeName?: unknown } | null | undefined)?.shapeName;

  return typeof shapeName === "string" ? shapeName : null;
}

function getShapeId(properties: unknown) {
  const shapeID = (properties as { shapeID?: unknown } | null | undefined)?.shapeID;

  return typeof shapeID === "string" && shapeID.length > 0 ? shapeID : null;
}

export function buildDistrictQuizInfos(districtsData: FeatureCollection | null): DistrictQuizInfo[] {
  if (!districtsData) {
    return [];
  }

  const result: DistrictQuizInfo[] = [];

  for (const feature of districtsData.features) {
    const name = getShapeName(feature.properties);
    const shapeId = getShapeId(feature.properties);

    if (!name || !shapeId || !feature.geometry) {
      continue;
    }

    const sample = sampleDistrictGeometry(feature.geometry);

    if (!sample) {
      continue;
    }

    const lookupEntry = districtLookup[shapeId];
    const province = lookupEntry?.province ?? "";

    result.push({
      id: `district_${shapeId}`,
      name,
      province,
      point: sample.centroid,
      pinPoints: sample.pinPoints,
      polygons: sample.polygons,
      neighborIds: (lookupEntry?.neighborShapeIds ?? []).map((neighborShapeId) => `district_${neighborShapeId}`),
    });
  }

  return result;
}

export function isPointInAnyPolygon(point: PlusPoint, polygons: DistrictPolygonPart[]) {
  return polygons.some(({ outer, holes }) => isPointInPolygon(point, outer, holes));
}
