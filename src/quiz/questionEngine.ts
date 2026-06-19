import type { EconomicFeature } from "../geojson/economicFeatures";
import { getEconomicFeatureDisplayName, isEconomicFeature } from "../geojson/economicFeatures";
import type { PhysicalFeature } from "../geojson/physicalFeatures";

export type QuizFeature = PhysicalFeature | EconomicFeature;

export type QuizPoint = {
  lat: number;
  lng: number;
};

export type QuestionKind = "mixed" | "mapLocate" | "oddOneOut";
export type QuizMode = "mixed" | "mapLocate" | "oddOneOut";
export type QuizDifficulty = "easy" | "medium" | "hard";
export type QuizRoundMode = "free" | "timed";

export type QuizChoice = {
  id: string;
  label: string;
  detail?: string;
};

export type QuizMapOption = {
  id: string;
  label: string;
  point: QuizPoint;
  name: string;
  categoryLabel: string;
  isCorrect: boolean;
};

export type QuizQuestion = {
  id: string;
  kind: QuestionKind;
  targetFeature: QuizFeature;
  targetPoint: QuizPoint;
  prompt: string;
  helper: string;
  answerSummary: string;
  expectedLabel: string;
  choices: QuizChoice[];
  correctChoiceIds: string[];
  mapOptions: QuizMapOption[];
  requiresMapAnswer: boolean;
  showTargetOnMap: boolean;
  allowsSecondAttempt: boolean;
  kpssNote: string;
};

export type QuizSessionStats = {
  answered: number;
  correct: number;
  wrong: number;
  targetCount: number;
  timeLeft: number;
  isComplete: boolean;
};

export type QuizAvailability = {
  total: number;
  mapLocate: number;
  oddOneOut: number;
};

export const QUIZ_CORRECT_RADIUS_KM = 75;
export const TIMED_ROUND_SECONDS = 60;
export const TIMED_ROUND_TARGET = 10;

export const quizModeOptions: Array<{ id: QuizMode; label: string }> = [
  { id: "mixed", label: "Karmaşık" },
  { id: "mapLocate", label: "Haritada Bul" },
  { id: "oddOneOut", label: "Farklı Türü Bul" },
];

export const quizDifficultyOptions: Array<{ id: QuizDifficulty; label: string }> = [
  { id: "easy", label: "Kolay" },
  { id: "medium", label: "Orta" },
  { id: "hard", label: "Zor" },
];

export const quizRoundModeOptions: Array<{ id: QuizRoundMode; label: string }> = [
  { id: "free", label: "Serbest" },
  { id: "timed", label: "60 sn / 10 soru" },
];

const mapOptionLabels = ["A", "B", "C", "D", "E"];

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getKey(item);

    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

function featurePoint(feature: QuizFeature): QuizPoint | null {
  const [lng, lat] = feature.geometry.coordinates;

  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}

export function getFeaturePoint(feature: QuizFeature): QuizPoint | null {
  return featurePoint(feature);
}

function featureDisplayName(feature: QuizFeature) {
  if (isEconomicFeature(feature)) {
    return getEconomicFeatureDisplayName(feature.properties);
  }

  const properties = feature.properties;
  const duplicateFriendlyLocation =
    properties.location && properties.location !== properties.region ? ` · ${properties.location}` : "";

  return `${properties.name}${duplicateFriendlyLocation}`;
}

function uniqueMapLocateCandidates(features: QuizFeature[]) {
  const nameCounts = features.reduce<Record<string, number>>((counts, feature) => {
    counts[feature.properties.name] = (counts[feature.properties.name] ?? 0) + 1;
    return counts;
  }, {});

  return features.filter((feature) => Boolean(featurePoint(feature)) && nameCounts[feature.properties.name] === 1);
}

function makeQuestion(
  kind: QuestionKind,
  targetFeature: QuizFeature,
  fields: Omit<QuizQuestion, "id" | "kind" | "targetFeature" | "targetPoint" | "kpssNote">,
): QuizQuestion | null {
  const targetPoint = featurePoint(targetFeature);

  if (!targetPoint) {
    return null;
  }

  return {
    ...fields,
    id: `${kind}_${targetFeature.properties.id}_${Date.now()}_${Math.round(Math.random() * 100000)}`,
    kind,
    targetFeature,
    targetPoint,
    kpssNote: targetFeature.properties.kpssNote,
  };
}

function buildMapLocate(target: QuizFeature, difficulty: QuizDifficulty) {
  const displayName = featureDisplayName(target);

  return makeQuestion("mapLocate", target, {
    prompt: `${displayName} haritada nerededir?`,
    helper: "GeoGuessr mantığında haritada tahmin noktanı bırak.",
    answerSummary: `${displayName} doğru konum olarak gösterildi.`,
    expectedLabel: displayName,
    choices: [],
    correctChoiceIds: [],
    mapOptions: [],
    requiresMapAnswer: true,
    showTargetOnMap: false,
    allowsSecondAttempt: difficulty !== "hard",
  });
}

function buildOddOneOut(target: QuizFeature, pool: QuizFeature[]) {
  const sameTopic = pool.filter((feature) => feature.properties.topic === target.properties.topic);
  const majorityCandidates = uniqueBy(
    sameTopic.filter((feature) => feature.properties.category === target.properties.category && featurePoint(feature)),
    (feature) => featureDisplayName(feature),
  );
  const oddCandidates = uniqueBy(
    sameTopic.filter((feature) => feature.properties.category !== target.properties.category && featurePoint(feature)),
    (feature) => featureDisplayName(feature),
  );

  if (majorityCandidates.length < 4 || oddCandidates.length < 1) {
    return null;
  }

  const majority = shuffle(majorityCandidates).slice(0, 4);
  const oddFeature = randomItem(oddCandidates);
  const optionFeatures = shuffle([...majority, oddFeature]);
  const oddIndex = optionFeatures.findIndex((feature) => feature.properties.id === oddFeature.properties.id);
  const correctLabel = mapOptionLabels[oddIndex];
  const mapOptions = optionFeatures.map((feature, index): QuizMapOption => {
    const point = featurePoint(feature);

    return {
      id: feature.properties.id,
      label: mapOptionLabels[index],
      point: point ?? { lat: 39, lng: 35 },
      name: featureDisplayName(feature),
      categoryLabel: feature.properties.categoryLabel,
      isCorrect: feature.properties.id === oddFeature.properties.id,
    };
  });
  const choices = mapOptions.map((option) => ({
    id: option.id,
    label: `${option.label} noktası`,
    detail: "Haritadaki işaretli noktayı seç",
  }));

  return makeQuestion("oddOneOut", oddFeature, {
    prompt: `Haritada işaretlenen 5 ${target.properties.topicLabel.toLocaleLowerCase("tr-TR")} noktasından hangisinin türü farklıdır?`,
    helper: "A-E işaretlerini karşılaştır; tür/kategori bakımından aykırı olan noktayı seç.",
    answerSummary: `${correctLabel} noktası farklıdır: ${featureDisplayName(oddFeature)} ${oddFeature.properties.categoryLabel}. Diğer dört nokta ${target.properties.categoryLabel} grubundadır.`,
    expectedLabel: `${correctLabel} noktası`,
    choices,
    correctChoiceIds: [oddFeature.properties.id],
    mapOptions,
    requiresMapAnswer: false,
    showTargetOnMap: false,
    allowsSecondAttempt: false,
  });
}

function getPreviousFeatureId(previousQuestionId: string | null) {
  return previousQuestionId?.split("_").slice(1, -2).join("_") ?? null;
}

function countOddOneOutSeeds(features: QuizFeature[]) {
  const seedIds = new Set<string>();
  const topicIds = new Set(features.map((feature) => feature.properties.topic));

  for (const topicId of topicIds) {
    const topicFeatures = features.filter((feature) => feature.properties.topic === topicId && featurePoint(feature));
    const categories = new Set(topicFeatures.map((feature) => feature.properties.category));

    for (const categoryId of categories) {
      const sameCategoryCount = uniqueBy(
        topicFeatures.filter((feature) => feature.properties.category === categoryId),
        (feature) => featureDisplayName(feature),
      ).length;
      const otherCategoryCount = uniqueBy(
        topicFeatures.filter((feature) => feature.properties.category !== categoryId),
        (feature) => featureDisplayName(feature),
      ).length;

      if (sameCategoryCount >= 4 && otherCategoryCount >= 1) {
        topicFeatures
          .filter((feature) => feature.properties.category === categoryId)
          .forEach((feature) => seedIds.add(feature.properties.id));
      }
    }
  }

  return seedIds.size;
}

export function getQuizAvailability(features: QuizFeature[], mode: QuizMode): QuizAvailability {
  const pool = features.filter((feature) => featurePoint(feature));
  const mapLocate = uniqueMapLocateCandidates(pool).length;
  const oddOneOut = countOddOneOutSeeds(pool);
  const total = mode === "mapLocate" ? mapLocate : mode === "oddOneOut" ? oddOneOut : mapLocate + oddOneOut;

  return { total, mapLocate, oddOneOut };
}

function buildQuestionByMode(mode: QuizMode, targets: QuizFeature[], pool: QuizFeature[], difficulty: QuizDifficulty) {
  const modes: QuizMode[] = mode === "mixed" ? shuffle(["mapLocate", "oddOneOut"]) : [mode];

  for (const candidateMode of modes) {
    if (candidateMode === "mapLocate") {
      const uniqueTargets = targets.filter((feature) =>
        uniqueMapLocateCandidates(pool).some((candidate) => candidate.properties.id === feature.properties.id),
      );

      for (const target of uniqueTargets) {
        const question = buildMapLocate(target, difficulty);

        if (question) {
          return question;
        }
      }
    }

    if (candidateMode === "oddOneOut") {
      for (const target of targets) {
        const question = buildOddOneOut(target, pool);

        if (question) {
          return question;
        }
      }
    }
  }

  return null;
}

export function generateQuizQuestion({
  features,
  mode,
  difficulty,
  previousQuestionId,
}: {
  features: QuizFeature[];
  mode: QuizMode;
  difficulty: QuizDifficulty;
  previousQuestionId: string | null;
}) {
  const pool = features.filter((feature) => featurePoint(feature));

  if (pool.length === 0) {
    return null;
  }

  const previousFeatureId = getPreviousFeatureId(previousQuestionId);
  const targets = shuffle(
    pool.length > 1 ? pool.filter((feature) => feature.properties.id !== previousFeatureId) : pool,
  );

  return buildQuestionByMode(mode, targets, pool, difficulty);
}

export function getDistanceKm(from: QuizPoint, to: QuizPoint) {
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

export function getHeatLabel(distanceKm: number) {
  if (distanceKm <= QUIZ_CORRECT_RADIUS_KM) {
    return "çok sıcak";
  }

  if (distanceKm <= 150) {
    return "sıcak";
  }

  if (distanceKm <= 300) {
    return "ılık";
  }

  return "soğuk";
}

export function getRegionOptions(features: QuizFeature[]) {
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

export function filterFeaturesByRegion(features: QuizFeature[], region: string) {
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

export function getChoiceCorrectness(question: QuizQuestion, choiceId: string) {
  return question.correctChoiceIds.includes(choiceId);
}
