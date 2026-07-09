// turkey-districts.geojson dosyasını (geoBoundaries TUR ADM2, 973 ilçe) KPSS
// açısından "kritik" ilçelerin oluşturduğu daha küçük bir alt kümeye indirger.
//
// Kritik ilçe: turkey-physical-features.geojson veya turkey-economic-features.geojson
// içindeki en az bir noktayı (maden, dağ, liman, baraj, ova vb.) barındıran ilçe.
//
// İl merkez ilçeleri kümeden HARİÇ tutulur — "ilin kendisi" ilçe kategorisinde
// ayrı bir soru üretmesin diye. Merkez ilçe, ADI "Merkez" ile eşleşen ilçedir
// (ör. "Ağrı merkez", "Kırıkkale (merkez)", bare "Merkez") — bu, birçok ilde
// il merkezinin ayrı bir özgün ad almadan "Merkez" olarak kaldığı için
// coğrafi ağırlık merkezi hesabından daha güvenilir bir sinyaldir. Sözcük
// sınırı kontrolü sayesinde "Merkezefendi" (Denizli) gibi gerçek özgün ilçe
// adları yanlışlıkla eşleşmez.
//
// public/geojson/turkey-districts.geojson İÇİNDE ÜZERİNE YAZILIR (973 → kritik
// alt küme). Baştan üretmek için önce ham ADM2 dosyasını yeniden indirin
// (bkz. public/geojson/README.md), sonra bu scripti, ardından
// buildDistrictNeighbors.mjs'i çalıştırın.
//
// Çalıştırma: node scripts/pruneCriticalDistricts.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const districtsPath = resolve(root, "public/geojson/turkey-districts.geojson");
const physicalPath = resolve(root, "public/geojson/turkey-physical-features.geojson");
const economicPath = resolve(root, "public/geojson/turkey-economic-features.geojson");

// "Merkez" tam kelime olarak eşleşir (ör. "Ağrı merkez", "(merkez)", bare
// "Merkez") ya da "merkezi" iyelik biçimiyle (ör. "Rize merkezi") — ama
// "Merkezefendi" gibi kaynaşık özgün adları yakalamaz.
const MERKEZ_NAME_PATTERN = /\bmerkez(i)?\b/i;

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
const districtsGeojson = JSON.parse(readFileSync(districtsPath, "utf8"));
const physicalGeojson = JSON.parse(readFileSync(physicalPath, "utf8"));
const economicGeojson = JSON.parse(readFileSync(economicPath, "utf8"));

if (districtsGeojson.features.length < 900) {
  console.error(
    `HATA: turkey-districts.geojson zaten daraltılmış görünüyor (${districtsGeojson.features.length} ilçe). ` +
      "Baştan üretmek için önce ham ADM2 dosyasını yeniden indirin (bkz. public/geojson/README.md).",
  );
  process.exit(1);
}

const districts = districtsGeojson.features
  .map((feature) => {
    const shapeID = feature.properties?.shapeID;
    const name = feature.properties?.shapeName;
    if (typeof shapeID !== "string" || !shapeID || typeof name !== "string" || !feature.geometry) return null;

    const parts = [];
    eachPolygonPart(feature.geometry, ({ outer, holes }) => {
      if (outer && outer.length >= 4) parts.push({ outer, holes });
    });
    const centroid = largestRingCentroid(feature.geometry);
    if (parts.length === 0 || !centroid) return null;

    return { shapeID, name, feature, parts, centroid, isMerkez: MERKEZ_NAME_PATTERN.test(name) };
  })
  .filter((d) => d !== null);

function findContainingDistrict(point) {
  return districts.find((district) => district.parts.some((part) => isPointInPolygon(point, part.outer, part.holes)));
}

function findNearestDistrict(point) {
  let nearest = null;
  let nearestDistSq = Infinity;
  for (const district of districts) {
    const distSq = distanceSq(point, district.centroid);
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = district;
    }
  }
  return nearest;
}

// --- Coğrafi/ekonomik öne çıkan ilçeler: fiziki/ekonomik nokta barındıran ilçe ---
const featureHostShapeIds = new Set();
let unmatchedFeatureCount = 0;

for (const feature of [...physicalGeojson.features, ...economicGeojson.features]) {
  if (feature.geometry?.type !== "Point") continue;
  const [lng, lat] = feature.geometry.coordinates;
  const point = { lat, lng };

  let match = findContainingDistrict(point);
  if (!match) {
    match = findNearestDistrict(point);
    unmatchedFeatureCount += 1;
  }

  if (match) {
    featureHostShapeIds.add(match.shapeID);
  }
}

// --- Merkez ilçeleri (ada göre) hariç tut ---
const merkezDistricts = districts.filter((district) => district.isMerkez);
const excludedMerkezCount = [...featureHostShapeIds].filter(
  (id) => merkezDistricts.some((district) => district.shapeID === id),
).length;
const criticalShapeIds = new Set(
  [...featureHostShapeIds].filter((id) => !merkezDistricts.some((district) => district.shapeID === id)),
);

// --- Filtrele ve yaz ---
const keptFeatures = districtsGeojson.features.filter((feature) => criticalShapeIds.has(feature.properties?.shapeID));

const prunedGeojson = { ...districtsGeojson, features: keptFeatures };
writeFileSync(districtsPath, JSON.stringify(prunedGeojson), "utf8");

console.log(`Yazıldı: ${districtsPath}`);
console.log(`Toplam kritik ilçe: ${keptFeatures.length} (kaynak: ${districtsGeojson.features.length})`);
console.log(`Coğrafi/ekonomik nokta barındıran ilçe sayısı: ${featureHostShapeIds.size}`);
console.log(`Adı "Merkez" ile eşleşen ilçe sayısı (hariç tutulan): ${merkezDistricts.length}`);
console.log(`Merkez ilçe olduğu için elenen coğrafi/ekonomik ilçe sayısı: ${excludedMerkezCount}`);
if (unmatchedFeatureCount > 0) {
  console.warn(`UYARI: ${unmatchedFeatureCount} fiziki/ekonomik nokta hiçbir ilçe poligonuna düşmedi, en yakın ilçeye atandı.`);
}
