import fs from "node:fs/promises";

const files = [
  {
    path: "public/geojson/turkey-physical-features.geojson",
    label: "physical",
    minCategoryCount: 4,
    categories: {
      mountain_fault_block: "mountain",
      mountain_fold: "mountain",
      mountain_volcanic: "mountain",
      plain_delta: "plain",
      plain_karstic: "plain",
      plain_tectonic: "plain",
      plateau_erosion: "plateau",
      plateau_karstic: "plateau",
      plateau_volcanic_lava: "plateau",
      plateau_horizontal: "plateau",
      river_black_sea: "river",
      river_marmara: "river",
      river_aegean: "river",
      river_mediterranean: "river",
      river_persian_gulf: "river",
      river_caspian: "river",
      lake_tectonic: "lake",
      lake_karstic: "lake",
      lake_volcanic: "lake",
      lake_landslide_dam: "lake",
      lake_coastal_barrier: "lake",
      lake_alluvial_dam: "lake",
      lake_volcanic_dam: "lake",
      coast_boyuna: "coast",
      coast_enine: "coast",
      coast_ria: "coast",
      coast_dalmatian: "coast",
      coast_limanli: "coast",
      coast_calankli: "coast",
    },
  },
  {
    path: "public/geojson/turkey-economic-features.geojson",
    label: "economic",
    minCategoryCount: 6,
    categories: {
      agriculture_cereal_legume: "agriculture",
      agriculture_industrial: "agriculture",
      agriculture_climate_selective: "agriculture",
      agriculture_special_crop: "agriculture",
      livestock_pasture: "livestock",
      livestock_stall: "livestock",
      livestock_small_ruminant: "livestock",
      livestock_specialized: "livestock",
      livestock_poultry_fishery: "livestock",
      mine_metal: "mine",
      mine_industrial: "mine",
      energy_fossil: "energy",
      energy_hydroelectric: "energy",
      energy_geothermal: "energy",
      energy_wind: "energy",
      energy_solar: "energy",
      industry_processing: "industry",
      industry_refinery_petrochemical: "industry",
      industry_automotive_machinery: "industry",
      industry_textile: "industry",
      industry_food_agro: "industry",
      industry_material: "industry",
      tourism_coastal: "tourism",
      tourism_cultural: "tourism",
      tourism_winter_thermal: "tourism",
      port_trade: "port",
      port_regional: "port",
    },
  },
];

const requiredProperties = [
  "id",
  "name",
  "topic",
  "topicLabel",
  "category",
  "categoryLabel",
  "region",
  "location",
  "kpssNote",
  "sourceName",
  "sourceUrl",
  "sourceQuery",
  "sourceDisplayName",
];

const turkeyBounds = {
  minLon: 25,
  maxLon: 46,
  minLat: 35,
  maxLat: 43,
};

function isInTurkeyBounds(lng, lat) {
  return (
    lng >= turkeyBounds.minLon &&
    lng <= turkeyBounds.maxLon &&
    lat >= turkeyBounds.minLat &&
    lat <= turkeyBounds.maxLat
  );
}

function propertyLabel(feature, index) {
  const id = feature.properties?.id;
  return typeof id === "string" ? id : `feature[${index}]`;
}

let errorCount = 0;

for (const file of files) {
  const raw = await fs.readFile(file.path, "utf8");
  const collection = JSON.parse(raw);
  const ids = new Set();
  const countsByCategory = new Map();

  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    console.error(`${file.path}: FeatureCollection bekleniyordu.`);
    errorCount += 1;
    continue;
  }

  for (const [index, feature] of collection.features.entries()) {
    const label = propertyLabel(feature, index);
    const properties = feature.properties ?? {};

    if (feature.geometry?.type !== "Point") {
      console.error(`${file.path}: ${label} Point geometrisi değil.`);
      errorCount += 1;
      continue;
    }

    const [lng, lat] = feature.geometry.coordinates ?? [];
    if (typeof lng !== "number" || typeof lat !== "number" || !isInTurkeyBounds(lng, lat)) {
      console.error(`${file.path}: ${label} Türkiye sınırları dışında/geçersiz koordinat taşıyor.`);
      errorCount += 1;
    }

    for (const property of requiredProperties) {
      if (typeof properties[property] !== "string" || properties[property].trim().length === 0) {
        console.error(`${file.path}: ${label} eksik/boş alan: ${property}`);
        errorCount += 1;
      }
    }

    if (typeof properties.id === "string") {
      if (ids.has(properties.id)) {
        console.error(`${file.path}: duplicate id: ${properties.id}`);
        errorCount += 1;
      }
      ids.add(properties.id);
    }

    const expectedTopic = file.categories[properties.category];
    if (!expectedTopic) {
      console.error(`${file.path}: ${label} bilinmeyen kategori: ${properties.category}`);
      errorCount += 1;
    } else if (properties.topic !== expectedTopic) {
      console.error(`${file.path}: ${label} kategori-topic uyumsuz: ${properties.category} -> ${properties.topic}`);
      errorCount += 1;
    }

    countsByCategory.set(properties.category, (countsByCategory.get(properties.category) ?? 0) + 1);
  }

  const weakCategories = Object.keys(file.categories)
    .map((category) => [category, countsByCategory.get(category) ?? 0])
    .filter(([, count]) => count > 0 && count < file.minCategoryCount);

  if (weakCategories.length > 0) {
    console.warn(
      `${file.path}: düşük temsil uyarısı: ${weakCategories
        .map(([category, count]) => `${category}=${count}`)
        .join(", ")}`,
    );
  }

  console.log(`${file.path}: ${collection.features.length} kayıt doğrulandı.`);
}

if (errorCount > 0) {
  console.error(`${errorCount} veri hatası bulundu.`);
  process.exitCode = 1;
}
