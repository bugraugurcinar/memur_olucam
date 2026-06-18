import type { Feature, FeatureCollection, Point } from "geojson";

export const physicalFeatureTopics = [
  { id: "mountain", label: "Dağlar", color: "#dc2626" },
  { id: "plain", label: "Ovalar", color: "#16a34a" },
  { id: "plateau", label: "Platolar", color: "#8b5cf6" },
  { id: "river", label: "Akarsular", color: "#2563eb" },
  { id: "lake", label: "Göller", color: "#0891b2" },
  { id: "coast", label: "Kıyı Tipleri", color: "#f59e0b" },
] as const;

export const physicalFeatureCategories = [
  { id: "mountain_fault_block", topic: "mountain", label: "Kırık", color: "#7c3aed" },
  { id: "mountain_fold", topic: "mountain", label: "Kıvrım", color: "#16a34a" },
  { id: "mountain_volcanic", topic: "mountain", label: "Volkanik", color: "#dc2626" },
  { id: "plain_delta", topic: "plain", label: "Delta", color: "#0891b2" },
  { id: "plain_karstic", topic: "plain", label: "Karstik", color: "#84cc16" },
  { id: "plain_tectonic", topic: "plain", label: "Tektonik", color: "#f97316" },
  { id: "plateau_erosion", topic: "plateau", label: "Aşınım", color: "#a855f7" },
  { id: "plateau_karstic", topic: "plateau", label: "Karstik", color: "#22c55e" },
  { id: "plateau_volcanic_lava", topic: "plateau", label: "Volkanik lav", color: "#ef4444" },
  { id: "plateau_horizontal", topic: "plateau", label: "Tabaka düzlüğü", color: "#f59e0b" },
  { id: "river_black_sea", topic: "river", label: "Karadeniz'e", color: "#0284c7" },
  { id: "river_marmara", topic: "river", label: "Marmara'ya", color: "#6366f1" },
  { id: "river_aegean", topic: "river", label: "Ege'ye", color: "#0d9488" },
  { id: "river_mediterranean", topic: "river", label: "Akdeniz'e", color: "#2563eb" },
  { id: "river_persian_gulf", topic: "river", label: "Basra Körfezi'ne", color: "#9333ea" },
  { id: "river_caspian", topic: "river", label: "Hazar Denizi'ne", color: "#14b8a6" },
  { id: "lake_tectonic", topic: "lake", label: "Tektonik", color: "#2563eb" },
  { id: "lake_karstic", topic: "lake", label: "Karstik", color: "#22c55e" },
  { id: "lake_volcanic", topic: "lake", label: "Volkanik", color: "#ef4444" },
  { id: "lake_landslide_dam", topic: "lake", label: "Heyelan set", color: "#a16207" },
  { id: "lake_coastal_barrier", topic: "lake", label: "Kıyı set", color: "#06b6d4" },
  { id: "lake_alluvial_dam", topic: "lake", label: "Alüvyal set", color: "#65a30d" },
  { id: "lake_volcanic_dam", topic: "lake", label: "Volkanik set", color: "#f97316" },
  { id: "coast_boyuna", topic: "coast", label: "Boyuna", color: "#f59e0b" },
  { id: "coast_enine", topic: "coast", label: "Enine", color: "#0ea5e9" },
  { id: "coast_ria", topic: "coast", label: "Ria", color: "#8b5cf6" },
  { id: "coast_dalmatian", topic: "coast", label: "Dalmaçya", color: "#ec4899" },
  { id: "coast_limanli", topic: "coast", label: "Limanlı", color: "#14b8a6" },
  { id: "coast_calankli", topic: "coast", label: "Kalanklı", color: "#f97316" },
] as const;

export type PhysicalFeatureTopic = (typeof physicalFeatureTopics)[number]["id"];
export type PhysicalFeatureCategory = (typeof physicalFeatureCategories)[number]["id"];

export type PhysicalFeatureProperties = {
  id: string;
  name: string;
  topic: PhysicalFeatureTopic;
  topicLabel: string;
  category: PhysicalFeatureCategory;
  categoryLabel: string;
  region: string;
  location: string;
  kpssNote: string;
  sourceName: string;
  sourceUrl: string;
  sourceQuery: string;
  sourceDisplayName: string;
};

export type PhysicalFeature = Feature<Point, PhysicalFeatureProperties>;

const topicIds = new Set<PhysicalFeatureTopic>(physicalFeatureTopics.map((topic) => topic.id));
const categoryIds = new Set<PhysicalFeatureCategory>(
  physicalFeatureCategories.map((category) => category.id),
);

export function isPhysicalFeature(feature: Feature): feature is PhysicalFeature {
  const properties = feature.properties as Partial<PhysicalFeatureProperties> | null;

  return (
    feature.geometry?.type === "Point" &&
    typeof properties?.id === "string" &&
    typeof properties.name === "string" &&
    typeof properties.topic === "string" &&
    typeof properties.category === "string" &&
    topicIds.has(properties.topic as PhysicalFeatureTopic) &&
    categoryIds.has(properties.category as PhysicalFeatureCategory)
  );
}

export function getPhysicalFeatures(data: FeatureCollection | null): PhysicalFeature[] {
  return data?.features.filter(isPhysicalFeature) ?? [];
}

export function getPhysicalFeatureTopic(topicId: PhysicalFeatureTopic) {
  return physicalFeatureTopics.find((topic) => topic.id === topicId) ?? physicalFeatureTopics[0];
}

export function getPhysicalFeatureCategory(categoryId: PhysicalFeatureCategory) {
  return (
    physicalFeatureCategories.find((category) => category.id === categoryId) ??
    physicalFeatureCategories[0]
  );
}

export function getPhysicalFeatureColor(
  feature: PhysicalFeatureProperties,
  shouldUseCategoryColor: boolean,
) {
  return shouldUseCategoryColor
    ? getPhysicalFeatureCategory(feature.category).color
    : getPhysicalFeatureTopic(feature.topic).color;
}
