import type { PlusPoint } from "./plusQuestionEngine";

/**
 * İl/ilçe sınırlarıyla çalışan Soru+ modları için paylaşılan poligon
 * geometrisi yardımcıları (şekil merkezi, poligon-içi testi, pin örnekleme).
 * Yan etki yok.
 */

export type Ring = number[][];

// Sınır başına üretilecek pin aday noktası sayısı ve örnekleme deneme limiti.
const PIN_CANDIDATE_TARGET = 12;
const PIN_SAMPLE_ATTEMPTS = 60;

export function ringSignedArea(ring: Ring) {
  let area = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index];
    const [x1, y1] = ring[index + 1];

    area += x0 * y1 - x1 * y0;
  }

  return area / 2;
}

export function ringCentroid(ring: Ring): PlusPoint {
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

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index];
    const [x1, y1] = ring[index + 1];
    const cross = x0 * y1 - x1 * y0;

    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  return { lat: cy / (6 * area), lng: cx / (6 * area) };
}

/** Ray-casting: nokta halkanın içinde mi? Koordinatlar [lng, lat]. */
export function isPointInRing(point: PlusPoint, ring: Ring) {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

/** Dış halka içinde ve deliklerin dışındaysa sınır içindedir. */
export function isPointInPolygon(point: PlusPoint, outer: Ring, holes: Ring[]) {
  if (!isPointInRing(point, outer)) {
    return false;
  }

  return holes.every((hole) => !isPointInRing(point, hole));
}

/**
 * Sınır içinde, kenar/köşelere doğru ağırlıklı rastgele pin noktaları üretir.
 * Merkezden sınıra doğru interpolasyon yaparak (yüksek oranlarda kenara yakın)
 * çeldirici dağılım sağlar; her aday poligon-içi testinden geçer.
 */
export function samplePinPoints(centroid: PlusPoint, outer: Ring, holes: Ring[]): PlusPoint[] {
  const points: PlusPoint[] = [];

  for (let attempt = 0; attempt < PIN_SAMPLE_ATTEMPTS && points.length < PIN_CANDIDATE_TARGET; attempt += 1) {
    // Hedef: kimi zaman bir köşe (vertex), kimi zaman bir kenar üzerindeki nokta.
    const vertexIndex = Math.floor(Math.random() * (outer.length - 1));
    const [vx, vy] = outer[vertexIndex];
    let targetLng = vx;
    let targetLat = vy;

    if (Math.random() < 0.5) {
      const [nx, ny] = outer[vertexIndex + 1] ?? outer[0];
      const edgeT = Math.random();
      targetLng = vx + (nx - vx) * edgeT;
      targetLat = vy + (ny - vy) * edgeT;
    }

    // Merkezden hedefe doğru: 0.45–0.9 arası → çoğunlukla kenara/köşeye yakın.
    const reach = 0.45 + Math.random() * 0.45;
    const candidate: PlusPoint = {
      lng: centroid.lng + (targetLng - centroid.lng) * reach,
      lat: centroid.lat + (targetLat - centroid.lat) * reach,
    };

    if (isPointInPolygon(candidate, outer, holes)) {
      points.push(candidate);
    }
  }

  // Merkezi de bir ihtimal olarak ekle ki her zaman kenarda olmasın — ancak
  // yalnızca sınır içinde kalıyorsa (konkav şekillerde merkez dışarı taşabilir).
  if (isPointInPolygon(centroid, outer, holes)) {
    points.push(centroid);
  }

  // Hiç aday bulunamadıysa son çare olarak merkezi kullan.
  return points.length > 0 ? points : [centroid];
}
