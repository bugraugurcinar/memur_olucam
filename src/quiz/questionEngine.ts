import type { EconomicFeature } from "../geojson/economicFeatures";
import { getEconomicFeatureDisplayName, isEconomicFeature } from "../geojson/economicFeatures";
import type { PhysicalFeature } from "../geojson/physicalFeatures";

export type QuizFeature = PhysicalFeature | EconomicFeature;

export type QuizPoint = {
  lat: number;
  lng: number;
};

export type QuestionKind =
  | "mapLocate"
  | "mapMatch"
  | "oddOneOut"
  | "nearby"
  | "regionPick"
  | "orderLine";
export type QuizMode = "mixed" | QuestionKind;
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
  mapMatch: number;
  oddOneOut: number;
  nearby: number;
  regionPick: number;
  orderLine: number;
};

export const QUIZ_CORRECT_RADIUS_KM = 75;
export const TIMED_ROUND_SECONDS = 60;
export const TIMED_ROUND_TARGET = 10;

export const quizModeOptions: Array<{ id: QuizMode; label: string }> = [
  { id: "mixed", label: "Karmaşık" },
  { id: "mapLocate", label: "Haritada Bul" },
  { id: "mapMatch", label: "Haritada Eşleştir" },
  { id: "oddOneOut", label: "Hangisi Değil" },
  { id: "nearby", label: "Yakın Olanı Bul" },
  { id: "regionPick", label: "Bölgeyi Bul" },
  { id: "orderLine", label: "Sıralama / Hat" },
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
const broadRegionFallbacks = new Set(["Türkiye"]);

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

function regionParts(feature: QuizFeature) {
  return feature.properties.region
    .split("/")
    .map((region) => region.trim())
    .filter((region) => region && !broadRegionFallbacks.has(region));
}

function uniquePointFeatures(features: QuizFeature[]) {
  return uniqueBy(
    features.filter((feature) => featurePoint(feature)),
    (feature) => featureDisplayName(feature),
  );
}

function uniqueMapLocateCandidates(features: QuizFeature[]) {
  const nameCounts = features.reduce<Record<string, number>>((counts, feature) => {
    counts[feature.properties.name] = (counts[feature.properties.name] ?? 0) + 1;
    return counts;
  }, {});

  return features.filter((feature) => Boolean(featurePoint(feature)) && nameCounts[feature.properties.name] === 1);
}

function uniqueDisplayNameCandidates(features: QuizFeature[]) {
  const displayNameCounts = features.reduce<Record<string, number>>((counts, feature) => {
    const displayName = featureDisplayName(feature);

    counts[displayName] = (counts[displayName] ?? 0) + 1;
    return counts;
  }, {});

  return features.filter(
    (feature) => Boolean(featurePoint(feature)) && displayNameCounts[featureDisplayName(feature)] === 1,
  );
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

function mapOptionsFromFeatures(optionFeatures: QuizFeature[], correctFeature: QuizFeature[]) {
  return optionFeatures.map((feature, index): QuizMapOption => {
    const point = featurePoint(feature);

    return {
      id: feature.properties.id,
      label: mapOptionLabels[index],
      point: point ?? { lat: 39, lng: 35 },
      name: featureDisplayName(feature),
      categoryLabel: feature.properties.categoryLabel,
      isCorrect: correctFeature.some((correct) => correct.properties.id === feature.properties.id),
    };
  });
}

function choicesFromMapOptions(mapOptions: QuizMapOption[], detail: string) {
  return mapOptions.map((option) => ({
    id: option.id,
    label: `${option.label} noktası`,
    detail,
  }));
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

function buildMapMatch(target: QuizFeature, pool: QuizFeature[]) {
  if (!uniqueDisplayNameCandidates(pool).some((feature) => feature.properties.id === target.properties.id)) {
    return null;
  }

  const targetDisplayName = featureDisplayName(target);
  const distractors = uniquePointFeatures(
    pool.filter(
      (feature) =>
        feature.properties.id !== target.properties.id && feature.properties.topic === target.properties.topic,
    ),
  ).filter((feature) => featureDisplayName(feature) !== targetDisplayName);

  if (distractors.length < 4) {
    return null;
  }

  const optionFeatures = shuffle([target, ...shuffle(distractors).slice(0, 4)]);
  const mapOptions = mapOptionsFromFeatures(optionFeatures, [target]);
  const correctOption = mapOptions.find((option) => option.isCorrect);

  if (!correctOption) {
    return null;
  }

  return makeQuestion("mapMatch", target, {
    prompt: `${targetDisplayName} hangi işaretli noktadadır?`,
    helper: "A-E işaretlerinden doğru konumu seç.",
    answerSummary: `${correctOption.label} noktası ${targetDisplayName} konumudur.`,
    expectedLabel: `${correctOption.label} noktası`,
    choices: choicesFromMapOptions(mapOptions, "Haritadaki doğru noktayı seç"),
    correctChoiceIds: [target.properties.id],
    mapOptions,
    requiresMapAnswer: false,
    showTargetOnMap: false,
    allowsSecondAttempt: false,
  });
}

function buildOddOneOut(target: QuizFeature, pool: QuizFeature[]) {
  const sameTopic = pool.filter((feature) => feature.properties.topic === target.properties.topic);
  const majorityCandidates = uniquePointFeatures(
    sameTopic.filter((feature) => feature.properties.category === target.properties.category),
  );
  const oddCandidates = uniquePointFeatures(
    sameTopic.filter((feature) => feature.properties.category !== target.properties.category),
  );

  if (majorityCandidates.length < 4 || oddCandidates.length < 1) {
    return null;
  }

  const majority = shuffle(majorityCandidates).slice(0, 4);
  const oddFeature = randomItem(oddCandidates);
  const optionFeatures = shuffle([...majority, oddFeature]);
  const mapOptions = mapOptionsFromFeatures(optionFeatures, [oddFeature]);
  const correctOption = mapOptions.find((option) => option.isCorrect);

  if (!correctOption) {
    return null;
  }

  return makeQuestion("oddOneOut", oddFeature, {
    prompt: `Haritada işaretlenen 5 ${target.properties.topicLabel.toLocaleLowerCase("tr-TR")} noktasından hangisi ${target.properties.categoryLabel} değildir?`,
    helper: "A-E işaretlerini karşılaştır; tür/kategori bakımından aykırı olan noktayı seç.",
    answerSummary: `${correctOption.label} noktası farklıdır: ${featureDisplayName(oddFeature)} ${oddFeature.properties.categoryLabel}. Diğer dört nokta ${target.properties.categoryLabel} grubundadır.`,
    expectedLabel: `${correctOption.label} noktası`,
    choices: choicesFromMapOptions(mapOptions, "Haritadaki farklı türü seç"),
    correctChoiceIds: [oddFeature.properties.id],
    mapOptions,
    requiresMapAnswer: false,
    showTargetOnMap: false,
    allowsSecondAttempt: false,
  });
}

function buildNearby(target: QuizFeature, pool: QuizFeature[]) {
  const targetPoint = featurePoint(target);

  if (!targetPoint) {
    return null;
  }

  const sortedCandidates = uniquePointFeatures(
    pool.filter((feature) => feature.properties.id !== target.properties.id),
  )
    .map((feature) => {
      const point = featurePoint(feature);
      return point ? { feature, distanceKm: getDistanceKm(targetPoint, point) } : null;
    })
    .filter((item): item is { feature: QuizFeature; distanceKm: number } => Boolean(item))
    .sort((left, right) => left.distanceKm - right.distanceKm);

  if (sortedCandidates.length < 5) {
    return null;
  }

  const correctFeature = sortedCandidates[0].feature;
  const optionFeatures = shuffle([
    correctFeature,
    ...shuffle(sortedCandidates.slice(1, Math.min(sortedCandidates.length, 18))).slice(0, 4).map((item) => item.feature),
  ]);
  const mapOptions = mapOptionsFromFeatures(optionFeatures, [correctFeature]);
  const correctOption = mapOptions.find((option) => option.isCorrect);

  if (!correctOption) {
    return null;
  }

  return makeQuestion("nearby", target, {
    prompt: `${featureDisplayName(target)} noktasına en yakın işaretli KPSS unsuru hangisidir?`,
    helper: "Mor soru noktasına göre A-E işaretlerinden en yakın olanı seç.",
    answerSummary: `${correctOption.label} noktası en yakındır: ${featureDisplayName(correctFeature)}.`,
    expectedLabel: `${correctOption.label} noktası`,
    choices: choicesFromMapOptions(mapOptions, "Soru noktasına en yakın işareti seç"),
    correctChoiceIds: [correctFeature.properties.id],
    mapOptions,
    requiresMapAnswer: false,
    showTargetOnMap: true,
    allowsSecondAttempt: false,
  });
}

function buildRegionPick(target: QuizFeature, pool: QuizFeature[]) {
  const candidateRegions = regionParts(target);

  if (candidateRegions.length === 0) {
    return null;
  }

  const targetRegion = randomItem(candidateRegions);
  const wrongCandidates = uniquePointFeatures(
    pool.filter((feature) => feature.properties.id !== target.properties.id && !regionParts(feature).includes(targetRegion)),
  );

  if (wrongCandidates.length < 4) {
    return null;
  }

  const optionFeatures = shuffle([target, ...shuffle(wrongCandidates).slice(0, 4)]);
  const mapOptions = mapOptionsFromFeatures(optionFeatures, [target]);
  const correctOption = mapOptions.find((option) => option.isCorrect);

  if (!correctOption) {
    return null;
  }

  return makeQuestion("regionPick", target, {
    prompt: `Haritadaki işaretlerden hangisi ${targetRegion} kapsamındadır?`,
    helper: "Bölge, havza veya dağılış ilişkisini haritadan seç.",
    answerSummary: `${correctOption.label} noktası ${targetRegion} kapsamındadır: ${featureDisplayName(target)}.`,
    expectedLabel: `${correctOption.label} noktası`,
    choices: choicesFromMapOptions(mapOptions, `${targetRegion} kapsamındaki noktayı seç`),
    correctChoiceIds: [target.properties.id],
    mapOptions,
    requiresMapAnswer: false,
    showTargetOnMap: false,
    allowsSecondAttempt: false,
  });
}

function buildOrderLine(target: QuizFeature, pool: QuizFeature[]) {
  const sameTopic = uniquePointFeatures(pool.filter((feature) => feature.properties.topic === target.properties.topic));

  if (sameTopic.length < 5) {
    return null;
  }

  const optionFeatures = shuffle([target, ...shuffle(sameTopic.filter((feature) => feature.properties.id !== target.properties.id)).slice(0, 4)]);
  const mapOptions = mapOptionsFromFeatures(optionFeatures, []);
  const direction = Math.random() > 0.5 ? "westEast" : "northSouth";
  const sortedOptions = [...mapOptions].sort((left, right) =>
    direction === "westEast" ? left.point.lng - right.point.lng : right.point.lat - left.point.lat,
  );
  const correctId = sortedOptions.map((option) => option.id).join("|");
  const correctLabel = sortedOptions.map((option) => option.label).join(" - ");
  const promptDirection = direction === "westEast" ? "batıdan doğuya" : "kuzeyden güneye";
  const choices = [{ id: correctId, label: correctLabel, detail: promptDirection }];
  const seenChoiceIds = new Set([correctId]);
  let attempts = 0;

  while (choices.length < 4 && attempts < 40) {
    attempts += 1;
    const shuffledOptions = shuffle(mapOptions);
    const id = shuffledOptions.map((option) => option.id).join("|");

    if (seenChoiceIds.has(id)) {
      continue;
    }

    seenChoiceIds.add(id);
    choices.push({
      id,
      label: shuffledOptions.map((option) => option.label).join(" - "),
      detail: promptDirection,
    });
  }

  if (choices.length < 4) {
    return null;
  }

  return makeQuestion("orderLine", target, {
    prompt: `Haritadaki 5 ${target.properties.topicLabel.toLocaleLowerCase("tr-TR")} noktasını ${promptDirection} doğru sıralayan seçenek hangisidir?`,
    helper: "A-E noktalarının konumlarını karşılaştır ve doğru sıralamayı seç.",
    answerSummary: `Doğru sıralama: ${correctLabel}.`,
    expectedLabel: correctLabel,
    choices: shuffle(choices),
    correctChoiceIds: [correctId],
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
      const sameCategoryCount = uniquePointFeatures(
        topicFeatures.filter((feature) => feature.properties.category === categoryId),
      ).length;
      const otherCategoryCount = uniquePointFeatures(
        topicFeatures.filter((feature) => feature.properties.category !== categoryId),
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

function countRegionPickSeeds(features: QuizFeature[]) {
  return features.filter((feature) => {
    const targetRegions = regionParts(feature);

    return (
      targetRegions.length > 0 &&
      targetRegions.some(
        (region) =>
          uniquePointFeatures(features.filter((candidate) => !regionParts(candidate).includes(region))).length >= 4,
      )
    );
  }).length;
}

function countOrderLineSeeds(features: QuizFeature[]) {
  const availableTopicIds = new Set(
    features
      .map((feature) => feature.properties.topic)
      .filter((topicId) => uniquePointFeatures(features.filter((feature) => feature.properties.topic === topicId)).length >= 5),
  );

  return features.filter((feature) => availableTopicIds.has(feature.properties.topic)).length;
}

export function getQuizAvailability(features: QuizFeature[], mode: QuizMode): QuizAvailability {
  const pool = features.filter((feature) => featurePoint(feature));
  const mapLocate = uniqueMapLocateCandidates(pool).length;
  const mapMatch = uniqueDisplayNameCandidates(pool).filter(
    (feature) =>
      uniquePointFeatures(
        pool.filter(
          (candidate) =>
            candidate.properties.id !== feature.properties.id &&
            candidate.properties.topic === feature.properties.topic &&
            featureDisplayName(candidate) !== featureDisplayName(feature),
        ),
      ).length >= 4,
  ).length;
  const oddOneOut = countOddOneOutSeeds(pool);
  const nearby = pool.length >= 6 ? pool.length : 0;
  const regionPick = countRegionPickSeeds(pool);
  const orderLine = countOrderLineSeeds(pool);
  const availability = { mapLocate, mapMatch, oddOneOut, nearby, regionPick, orderLine };
  const total =
    mode === "mixed"
      ? Object.values(availability).reduce((sum, count) => sum + count, 0)
      : availability[mode];

  return { total, ...availability };
}

function modeCandidates(mode: QuizMode, difficulty: QuizDifficulty): QuestionKind[] {
  if (mode !== "mixed") {
    return [mode];
  }

  if (difficulty === "easy") {
    return shuffle(["mapMatch", "regionPick", "mapLocate", "oddOneOut"]);
  }

  if (difficulty === "hard") {
    return shuffle(["orderLine", "oddOneOut", "nearby", "regionPick", "mapLocate"]);
  }

  return shuffle(["mapLocate", "mapMatch", "oddOneOut", "nearby", "regionPick", "orderLine"]);
}

function buildQuestionByKind(
  kind: QuestionKind,
  target: QuizFeature,
  pool: QuizFeature[],
  difficulty: QuizDifficulty,
) {
  if (kind === "mapLocate") {
    const uniqueTargets = uniqueMapLocateCandidates(pool);

    if (!uniqueTargets.some((feature) => feature.properties.id === target.properties.id)) {
      return null;
    }

    return buildMapLocate(target, difficulty);
  }

  if (kind === "mapMatch") {
    return buildMapMatch(target, pool);
  }

  if (kind === "oddOneOut") {
    return buildOddOneOut(target, pool);
  }

  if (kind === "nearby") {
    return buildNearby(target, pool);
  }

  if (kind === "regionPick") {
    return buildRegionPick(target, pool);
  }

  return buildOrderLine(target, pool);
}

function buildQuestionByMode(mode: QuizMode, targets: QuizFeature[], pool: QuizFeature[], difficulty: QuizDifficulty) {
  const kinds = modeCandidates(mode, difficulty);

  for (const kind of kinds) {
    for (const target of targets) {
      const question = buildQuestionByKind(kind, target, pool, difficulty);

      if (question) {
        return question;
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
