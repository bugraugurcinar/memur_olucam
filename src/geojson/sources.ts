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
} as const;

export const geoJsonAttribution =
  "Veri: geoBoundaries / OpenStreetMap, CC BY-SA 2.0";
