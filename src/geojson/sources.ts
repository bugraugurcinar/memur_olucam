export const geoJsonSources = {
  country: {
    label: "Türkiye sınırı",
    url: "/geojson/turkey-country.geojson",
    sourceName: "geoBoundaries TUR ADM0",
  },
  provinces: {
    label: "İl sınırları",
    url: "/geojson/turkey-provinces.geojson",
    sourceName: "geoBoundaries TUR ADM1",
  },
  physicalFeatures: {
    label: "Fiziki yer şekilleri",
    url: "/geojson/turkey-physical-features.geojson",
    sourceName: "OpenStreetMap / Photon",
  },
  economicFeatures: {
    label: "Ekonomik coğrafya",
    url: "/geojson/turkey-economic-features.geojson",
    sourceName: "KPSS temsil noktaları",
  },
} as const;

export const geoJsonAttribution =
  "Veri: geoBoundaries, OpenStreetMap ve KPSS temsil noktaları";
