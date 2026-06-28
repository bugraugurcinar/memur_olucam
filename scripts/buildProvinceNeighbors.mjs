// Türkiye il komşuluk haritasını il GeoJSON'undan üretir.
//
// Komşuluk, geoBoundaries ADM1 poligonlarının ortak sınır boyunca paylaştığı
// köşe noktalarından çıkarılır: iki il, ~110 m'ye yuvarlanmış en az bir ortak
// köşeye sahipse komşu sayılır (aynı kaynaktan üretilen idari sınırlar ortak
// sınırda neredeyse aynı köşe dizisini paylaşır). Sonuç
// src/geojson/provinceNeighbors.ts dosyasına yazılır.
//
// Çalıştırma:  node scripts/buildProvinceNeighbors.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const inputPath = resolve(root, "public/geojson/turkey-provinces.geojson");
const outputPath = resolve(root, "src/geojson/provinceNeighbors.ts");

// 3 ondalık ≈ 110 m. Ortak sınır köşelerini eşleştirmek için yeterince hassas.
const PRECISION = 3;

function key(lng, lat) {
  return `${lng.toFixed(PRECISION)},${lat.toFixed(PRECISION)}`;
}

function eachRing(geometry, visit) {
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) visit(ring);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) visit(ring);
    }
  }
}

const geojson = JSON.parse(readFileSync(inputPath, "utf8"));

// Her köşe anahtarı -> o köşeye değen il adları kümesi.
const vertexProvinces = new Map();
const provinceNames = [];

for (const feature of geojson.features) {
  const name = feature.properties?.shapeName;
  if (typeof name !== "string") continue;
  provinceNames.push(name);

  const seen = new Set();
  eachRing(feature.geometry, (ring) => {
    for (const [lng, lat] of ring) {
      const k = key(lng, lat);
      if (seen.has(k)) continue;
      seen.add(k);
      let bucket = vertexProvinces.get(k);
      if (!bucket) {
        bucket = new Set();
        vertexProvinces.set(k, bucket);
      }
      bucket.add(name);
    }
  });
}

const neighbors = new Map(provinceNames.map((name) => [name, new Set()]));

for (const bucket of vertexProvinces.values()) {
  if (bucket.size < 2) continue;
  const names = [...bucket];
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      neighbors.get(names[i]).add(names[j]);
      neighbors.get(names[j]).add(names[i]);
    }
  }
}

const sortedNames = [...provinceNames].sort((a, b) => a.localeCompare(b, "tr"));
const entries = sortedNames.map((name) => {
  const list = [...neighbors.get(name)].sort((a, b) => a.localeCompare(b, "tr"));
  return [name, list];
});

const counts = entries.map(([, list]) => list.length);
const min = Math.min(...counts);
const max = Math.max(...counts);
const avg = (counts.reduce((sum, n) => sum + n, 0) / counts.length).toFixed(1);
const orphans = entries.filter(([, list]) => list.length === 0).map(([name]) => name);

const body = entries
  .map(([name, list]) => `  ${JSON.stringify(name)}: [${list.map((n) => JSON.stringify(n)).join(", ")}],`)
  .join("\n");

const fileContents = `// OTOMATİK ÜRETİLDİ — elle düzenlemeyin.
// Kaynak: scripts/buildProvinceNeighbors.mjs (public/geojson/turkey-provinces.geojson)
// Yeniden üretmek için: node scripts/buildProvinceNeighbors.mjs

export const provinceNeighbors: Record<string, string[]> = {
${body}
};
`;

writeFileSync(outputPath, fileContents, "utf8");

console.log(`Yazıldı: ${outputPath}`);
console.log(`İl sayısı: ${entries.length} · komşu sayısı min ${min}, maks ${max}, ort ${avg}`);
if (orphans.length > 0) {
  console.warn(`UYARI: komşusu bulunamayan iller: ${orphans.join(", ")}`);
}
