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
  { id: "mountain_fault_block", topic: "mountain", label: "Kırık" },
  { id: "mountain_fold", topic: "mountain", label: "Kıvrım" },
  { id: "mountain_volcanic", topic: "mountain", label: "Volkanik" },
  { id: "plain_delta", topic: "plain", label: "Delta" },
  { id: "plain_karstic", topic: "plain", label: "Karstik" },
  { id: "plain_tectonic", topic: "plain", label: "Tektonik" },
  { id: "plateau_erosion", topic: "plateau", label: "Aşınım" },
  { id: "plateau_karstic", topic: "plateau", label: "Karstik" },
  { id: "plateau_volcanic_lava", topic: "plateau", label: "Volkanik lav" },
  { id: "plateau_horizontal", topic: "plateau", label: "Tabaka düzlüğü" },
  { id: "river_black_sea", topic: "river", label: "Karadeniz'e" },
  { id: "river_marmara", topic: "river", label: "Marmara'ya" },
  { id: "river_aegean", topic: "river", label: "Ege'ye" },
  { id: "river_mediterranean", topic: "river", label: "Akdeniz'e" },
  { id: "river_persian_gulf", topic: "river", label: "Basra Körfezi'ne" },
  { id: "river_caspian", topic: "river", label: "Hazar Denizi'ne" },
  { id: "lake_tectonic", topic: "lake", label: "Tektonik" },
  { id: "lake_karstic", topic: "lake", label: "Karstik" },
  { id: "lake_volcanic", topic: "lake", label: "Volkanik" },
  { id: "lake_landslide_dam", topic: "lake", label: "Heyelan set" },
  { id: "lake_coastal_barrier", topic: "lake", label: "Kıyı set" },
  { id: "lake_alluvial_dam", topic: "lake", label: "Alüvyal set" },
  { id: "lake_volcanic_dam", topic: "lake", label: "Volkanik set" },
  { id: "coast_boyuna", topic: "coast", label: "Boyuna" },
  { id: "coast_enine", topic: "coast", label: "Enine" },
  { id: "coast_ria", topic: "coast", label: "Ria" },
  { id: "coast_dalmatian", topic: "coast", label: "Dalmaçya" },
  { id: "coast_limanli", topic: "coast", label: "Limanlı" },
  { id: "coast_calankli", topic: "coast", label: "Kalanklı" },
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
