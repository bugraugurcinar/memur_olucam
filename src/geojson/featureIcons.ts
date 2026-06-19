import type { EconomicFeatureProperties, EconomicFeatureTopic } from "./economicFeatures";
import type { PhysicalFeatureProperties, PhysicalFeatureTopic } from "./physicalFeatures";

export function getPhysicalFeatureIconName(
  feature: Pick<PhysicalFeatureProperties, "category" | "topic">,
) {
  if (feature.topic === "mountain" && feature.category === "mountain_volcanic") {
    return "volcano";
  }

  const icons: Record<PhysicalFeatureTopic, string> = {
    mountain: "mountain",
    plain: "field",
    plateau: "layers",
    river: "river",
    lake: "lake",
    coast: "coast",
  };

  return icons[feature.topic];
}

export function getEconomicFeatureIconName(
  feature: Pick<EconomicFeatureProperties, "category" | "topic">,
) {
  if (feature.category === "energy_hydroelectric") {
    return "hydro";
  }

  if (feature.category === "energy_geothermal" || feature.category === "energy_fossil") {
    return "flame";
  }

  if (feature.category === "energy_wind") {
    return "wind";
  }

  if (feature.category === "energy_solar") {
    return "sun";
  }

  const icons: Record<EconomicFeatureTopic, string> = {
    agriculture: "leaf",
    livestock: "barn",
    mine: "pickaxe",
    energy: "bolt",
    industry: "factory",
    tourism: "camera",
    port: "anchor",
  };

  return icons[feature.topic];
}

export function getFeatureIconName(feature: PhysicalFeatureProperties | EconomicFeatureProperties) {
  if (
    feature.topic === "agriculture" ||
    feature.topic === "livestock" ||
    feature.topic === "mine" ||
    feature.topic === "energy" ||
    feature.topic === "industry" ||
    feature.topic === "tourism" ||
    feature.topic === "port"
  ) {
    return getEconomicFeatureIconName(feature as EconomicFeatureProperties);
  }

  return getPhysicalFeatureIconName(feature as PhysicalFeatureProperties);
}
