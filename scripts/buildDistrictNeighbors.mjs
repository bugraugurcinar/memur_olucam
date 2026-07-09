// Türkiye ilçe → il eşlemesini ve ilçe komşuluk haritasını üretir.
//
// İl eşlemesi: her ilçenin en büyük halkasının ağırlık merkezi, il poligonlarına
// karşı ray-casting ile test edilir (geoBoundaries ADM2 verisinde üst-il alanı
// yoktur, bu yüzden bağlantı geometrik olarak kurulur). Eşleşme bulunamazsa
// (bağımsız sadeleştirilmiş ADM1/ADM2 sınırlarının tam örtüşmemesi durumunda)
// en yakın il merkez noktasına düşülür ve uyarı yazdırılır.
//
// Komşuluk: buildProvinceNeighbors.mjs ile aynı yöntem (ortak köşe paylaşımı,
// ~110 m hassasiyet) ama isim yerine shapeID ile anahtarlanır — çünkü ilçe
// adları iller arasında benzersiz değildir (ör. birden fazla "Merkez" ilçesi).
//
// Sonuç: src/geojson/districtNeighbors.ts
// Çalıştırma: node scripts/buildDistrictNeighbors.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const provincesPath = resolve(root, "public/geojson/turkey-provinces.geojson");
const districtsPath = resolve(root, "public/geojson/turkey-districts.geojson");
const outputPath = resolve(root, "src/geojson/districtNeighbors.ts");

// 3 ondalık ≈ 110 m. Ortak sınır köşelerini eşleştirmek için yeterince hassas.
const PRECISION = 3;

function key(lng, lat) {
  return `${lng.toFixed(PRECISION)},${lat.toFixed(PRECISION)}`;
}

/** Her halkayı (dış + delik) ziyaret eder — komşuluk köşe taramasında kullanılır. */
function eachRing(geometry, visit) {
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) visit(ring);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) visit(ring);
    }
  }
}

/** Her poligon parçasını { outer, holes } olarak ziyaret eder — poligon-içi testinde kullanılır. */
function eachPolygonPart(geometry, visit) {
  if (geometry.type === "Polygon") {
    visit({ outer: geometry.coordinates[0], holes: geometry.coordinates.slice(1) });
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      visit({ outer: polygon[0], holes: polygon.slice(1) });
    }
  }
}

function ringSignedArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    area += x0 * y1 - x1 * y0;
  }
  return area / 2;
}

function ringCentroid(ring) {
  const area = ringSignedArea(ring);
  if (area === 0) {
    const total = ring.reduce(
      (sum, [lng, lat]) => ({ lng: sum.lng + lng, lat: sum.lat + lat }),
      { lng: 0, lat: 0 },
    );
    const count = Math.max(ring.length, 1);
    return { lat: total.lat / count, lng: total.lng / count };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  return { lat: cy / (6 * area), lng: cx / (6 * area) };
}

/** Ray-casting: nokta halkanın içinde mi? Koordinatlar [lng, lat]. */
function isPointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isPointInPolygon(point, outer, holes) {
  if (!isPointInRing(point, outer)) return false;
  return holes.every((hole) => !isPointInRing(point, hole));
}

/** Geometrinin en büyük (alan) halkasının merkezini döndürür. */
function largestRingCentroid(geometry) {
  let best = null;
  eachPolygonPart(geometry, ({ outer }) => {
    if (!outer || outer.length < 4) return;
    const area = Math.abs(ringSignedArea(outer));
    if (!best || area > best.area) best = { outer, area };
  });
  return best ? ringCentroid(best.outer) : null;
}

function distanceSq(a, b) {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

// --- Veriyi oku ---
const provincesGeojson = JSON.parse(readFileSync(provincesPath, "utf8"));
const districtsGeojson = JSON.parse(readFileSync(districtsPath, "utf8"));

const provinces = [];
for (const feature of provincesGeojson.features) {
  const name = feature.properties?.shapeName;
  if (typeof name !== "string" || !feature.geometry) continue;

  const parts = [];
  eachPolygonPart(feature.geometry, ({ outer, holes }) => {
    if (outer && outer.length >= 4) parts.push({ outer, holes });
  });
  const centroid = largestRingCentroid(feature.geometry);
  if (parts.length === 0 || !centroid) continue;

  provinces.push({ name, parts, centroid });
}

// --- İlçe → il eşlemesi + shapeID toplama ---
const districts = [];
const idsSeen = new Set();
let duplicateIds = 0;

for (const feature of districtsGeojson.features) {
  const name = feature.properties?.shapeName;
  const shapeID = feature.properties?.shapeID;

  if (typeof name !== "string" || typeof shapeID !== "string" || !shapeID || !feature.geometry) {
    console.warn(`UYARI: eksik alan, atlanan ilçe kaydı: ${JSON.stringify(feature.properties)}`);
    continue;
  }

  if (idsSeen.has(shapeID)) {
    duplicateIds += 1;
    console.error(`HATA: tekrarlanan shapeID: ${shapeID} (${name})`);
    continue;
  }
  idsSeen.add(shapeID);

  const centroid = largestRingCentroid(feature.geometry);
  if (!centroid) continue;

  let province = null;
  for (const candidate of provinces) {
    const matched = candidate.parts.some((part) => isPointInPolygon(centroid, part.outer, part.holes));
    if (matched) {
      province = candidate.name;
      break;
    }
  }

  let usedFallback = false;
  if (!province) {
    usedFallback = true;
    let nearest = null;
    let nearestDistSq = Infinity;
    for (const candidate of provinces) {
      const distSq = distanceSq(centroid, candidate.centroid);
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = candidate.name;
      }
    }
    province = nearest;
    console.warn(`UYARI: ${name} (${shapeID}) için poligon-içi eşleşme bulunamadı, en yakın il kullanıldı: ${province}`);
  }

  districts.push({ shapeID, name, province, usedFallback });
}

if (duplicateIds > 0) {
  process.exitCode = 1;
}

const districtsByProvince = new Map();
for (const district of districts) {
  districtsByProvince.set(district.province, (districtsByProvince.get(district.province) ?? 0) + 1);
}
const provincesWithoutDistricts = provinces.filter((province) => !districtsByProvince.has(province.name));
if (provincesWithoutDistricts.length > 0) {
  console.error(`HATA: hiç ilçesi eşleşmeyen iller: ${provincesWithoutDistricts.map((province) => province.name).join(", ")}`);
  process.exitCode = 1;
}

// --- Komşuluk (ortak köşe paylaşımı, shapeID ile anahtarlanır) ---
const vertexDistricts = new Map();

for (const feature of districtsGeojson.features) {
  const shapeID = feature.properties?.shapeID;
  if (typeof shapeID !== "string" || !idsSeen.has(shapeID) || !feature.geometry) continue;

  const seen = new Set();
  eachRing(feature.geometry, (ring) => {
    for (const [lng, lat] of ring) {
      const k = key(lng, lat);
      if (seen.has(k)) continue;
      seen.add(k);
      let bucket = vertexDistricts.get(k);
      if (!bucket) {
        bucket = new Set();
        vertexDistricts.set(k, bucket);
      }
      bucket.add(shapeID);
    }
  });
}

const neighborSets = new Map(districts.map((district) => [district.shapeID, new Set()]));

for (const bucket of vertexDistricts.values()) {
  if (bucket.size < 2) continue;
  const ids = [...bucket];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      neighborSets.get(ids[i])?.add(ids[j]);
      neighborSets.get(ids[j])?.add(ids[i]);
    }
  }
}

// --- Çıktı ---
const sortedDistricts = [...districts].sort(
  (a, b) => a.name.localeCompare(b.name, "tr") || a.province.localeCompare(b.province, "tr"),
);

const entries = sortedDistricts.map((district) => ({
  shapeID: district.shapeID,
  province: district.province,
  neighborShapeIds: [...(neighborSets.get(district.shapeID) ?? new Set())].sort(),
}));

const counts = entries.map((entry) => entry.neighborShapeIds.length);
const min = Math.min(...counts);
const max = Math.max(...counts);
const avg = (counts.reduce((sum, n) => sum + n, 0) / counts.length).toFixed(1);
const orphans = sortedDistricts
  .filter((_, index) => entries[index].neighborShapeIds.length === 0)
  .map((district) => `${district.name} (${district.province})`);
const fallbackCount = districts.filter((district) => district.usedFallback).length;

const body = entries
  .map(
    (entry) =>
      `  ${JSON.stringify(entry.shapeID)}: { province: ${JSON.stringify(entry.province)}, neighborShapeIds: [${entry.neighborShapeIds
        .map((id) => JSON.stringify(id))
        .join(", ")}] },`,
  )
  .join("\n");

const fileContents = `// OTOMATİK ÜRETİLDİ — elle düzenlemeyin.
// Kaynak: scripts/buildDistrictNeighbors.mjs
// (public/geojson/turkey-districts.geojson + public/geojson/turkey-provinces.geojson)
// Yeniden üretmek için: node scripts/buildDistrictNeighbors.mjs

export type DistrictLookupEntry = {
  province: string;
  neighborShapeIds: string[];
};

export const districtLookup: Record<string, DistrictLookupEntry> = {
${body}
};
`;

writeFileSync(outputPath, fileContents, "utf8");

console.log(`Yazıldı: ${outputPath}`);
console.log(`İlçe sayısı: ${entries.length} (kaynak: ${districtsGeojson.features.length})`);
console.log(`Komşu sayısı: min ${min}, maks ${max}, ort ${avg}`);
console.log(`İl sayısı: ${provinces.length} · ilçesi eşleşen il sayısı: ${districtsByProvince.size}`);
if (fallbackCount > 0) {
  console.warn(`UYARI: ${fallbackCount} ilçe için en-yakın-il yedeği kullanıldı (poligon-içi eşleşme bulunamadı).`);
}
if (orphans.length > 0) {
  console.warn(`UYARI: komşusu bulunamayan ilçeler: ${orphans.join(", ")}`);
}
