import type { PlusFeature } from "./plusQuestionEngine";

export type GeoPoint = {
  lat: number;
  lng: number;
};

export const QUIZ_CORRECT_RADIUS_KM = 75;

export function getDistanceKm(from: GeoPoint, to: GeoPoint) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const startLat = toRadians(from.lat);
  const endLat = toRadians(to.lat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function formatDistanceKm(distanceKm: number) {
  return distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm).toString();
}

export function getRegionOptions(features: PlusFeature[]) {
  return Array.from(
    new Set(
      features.flatMap((feature) =>
        feature.properties.region
          .split("/")
          .map((region) => region.trim())
          .filter(Boolean),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right, "tr"));
}

export function filterFeaturesByRegion<T extends PlusFeature>(features: T[], region: string) {
  if (region === "all") {
    return features;
  }

  return features.filter((feature) =>
    feature.properties.region
      .split("/")
      .map((item) => item.trim())
      .includes(region),
  );
}
