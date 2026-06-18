import type { Feature, FeatureCollection, Point } from "geojson";

export const economicFeatureTopics = [
  { id: "agriculture", label: "Tarım", color: "#65a30d" },
  { id: "livestock", label: "Hayvancılık", color: "#a16207" },
  { id: "mine", label: "Madenler", color: "#64748b" },
  { id: "energy", label: "Enerji Kaynakları", color: "#ea580c" },
  { id: "industry", label: "Sanayi Tesisleri", color: "#0f766e" },
] as const;

export const economicFeatureCategories = [
  { id: "agriculture_cereal_legume", topic: "agriculture", label: "Tahıl / baklagil", color: "#ca8a04" },
  { id: "agriculture_industrial", topic: "agriculture", label: "Sanayi bitkisi", color: "#dc2626" },
  { id: "agriculture_climate_selective", topic: "agriculture", label: "İklim seçiciliği fazla", color: "#16a34a" },
  { id: "agriculture_special_crop", topic: "agriculture", label: "Meyve / özel ürün", color: "#eab308" },
  { id: "livestock_pasture", topic: "livestock", label: "Mera hayvancılığı", color: "#84cc16" },
  { id: "livestock_stall", topic: "livestock", label: "Besi / ahır", color: "#f59e0b" },
  { id: "livestock_small_ruminant", topic: "livestock", label: "Küçükbaş", color: "#a16207" },
  { id: "livestock_specialized", topic: "livestock", label: "Özel hayvancılık", color: "#8b5cf6" },
  { id: "livestock_poultry_fishery", topic: "livestock", label: "Kümes / balıkçılık", color: "#0ea5e9" },
  { id: "mine_metal", topic: "mine", label: "Metal madenleri", color: "#64748b" },
  { id: "mine_industrial", topic: "mine", label: "Endüstriyel maden", color: "#7c3aed" },
  { id: "energy_fossil", topic: "energy", label: "Fosil enerji kaynağı", color: "#ea580c" },
  { id: "industry_processing", topic: "industry", label: "İşleme / sanayi tesisi", color: "#0f766e" },
  { id: "industry_refinery_petrochemical", topic: "industry", label: "Rafineri / petrokimya", color: "#0891b2" },
  { id: "industry_automotive_machinery", topic: "industry", label: "Otomotiv / makine", color: "#2563eb" },
  { id: "industry_textile", topic: "industry", label: "Tekstil / dokuma", color: "#db2777" },
] as const;

export type EconomicFeatureTopic = (typeof economicFeatureTopics)[number]["id"];
export type EconomicFeatureCategory = (typeof economicFeatureCategories)[number]["id"];

export type EconomicFeatureProperties = {
  id: string;
  name: string;
  topic: EconomicFeatureTopic;
  topicLabel: string;
  category: EconomicFeatureCategory;
  categoryLabel: string;
  region: string;
  location: string;
  kpssNote: string;
  sourceName: string;
  sourceUrl: string;
  sourceQuery: string;
  sourceDisplayName: string;
};

export type EconomicFeature = Feature<Point, EconomicFeatureProperties>;

const topicIds = new Set<EconomicFeatureTopic>(economicFeatureTopics.map((topic) => topic.id));
const categoryIds = new Set<EconomicFeatureCategory>(
  economicFeatureCategories.map((category) => category.id),
);

export function isEconomicFeature(feature: Feature): feature is EconomicFeature {
  const properties = feature.properties as Partial<EconomicFeatureProperties> | null;

  return (
    feature.geometry?.type === "Point" &&
    typeof properties?.id === "string" &&
    typeof properties.name === "string" &&
    typeof properties.topic === "string" &&
    typeof properties.category === "string" &&
    topicIds.has(properties.topic as EconomicFeatureTopic) &&
    categoryIds.has(properties.category as EconomicFeatureCategory)
  );
}

export function getEconomicFeatures(data: FeatureCollection | null): EconomicFeature[] {
  return data?.features.filter(isEconomicFeature) ?? [];
}

export function getEconomicFeatureTopic(topicId: EconomicFeatureTopic) {
  return economicFeatureTopics.find((topic) => topic.id === topicId) ?? economicFeatureTopics[0];
}

export function getEconomicFeatureCategory(categoryId: EconomicFeatureCategory) {
  return (
    economicFeatureCategories.find((category) => category.id === categoryId) ??
    economicFeatureCategories[0]
  );
}

export function getEconomicFeatureColor(
  feature: EconomicFeatureProperties,
  shouldUseCategoryColor: boolean,
) {
  return shouldUseCategoryColor
    ? getEconomicFeatureCategory(feature.category).color
    : getEconomicFeatureTopic(feature.topic).color;
}
