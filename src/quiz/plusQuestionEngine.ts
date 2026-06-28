import {
  getEconomicFeatureDisplayName,
  getEconomicLocationShortLabel,
  isEconomicFeature,
  type EconomicFeature,
} from "../geojson/economicFeatures";
import { getFeatureIconName } from "../geojson/featureIcons";
import { isPhysicalFeature, type PhysicalFeature } from "../geojson/physicalFeatures";

export type PlusFeature = PhysicalFeature | EconomicFeature;

export type PlusQuestionKind = "mapLocate" | "mapMatch" | "placement" | "pickOne" | "pickMany" | "choice";
export type PlusQuestionMode = "mixed" | PlusQuestionKind;

export type PlusQuestionTopic =
  | "mixed"
  | "mine"
  | "industry"
  | "energy"
  | "agriculture"
  | "livestock"
  | "mountain"
  | "river"
  | "lake"
  | "plainPlateau"
  | "coast"
  | "tourism"
  | "port"
  | "province";

export type PlusPoint = {
  lat: number;
  lng: number;
};

/** İl tahmin modu için tek bir ilin sorulabilir bilgisi (saf girdi). */
export type ProvinceQuizInfo = {
  id: string;
  name: string;
  point: PlusPoint;
  neighbors: string[];
};

export type PlusMapTarget = {
  id: string;
  label: string;
  point: PlusPoint;
  name: string;
  detail: string;
  color: string;
  markerIconName: string;
};

export type PlusToken = {
  id: string;
  label: string;
  detail: string;
  color: string;
};

export type PlusQuestion = {
  id: string;
  topic: Exclude<PlusQuestionTopic, "mixed">;
  kind: PlusQuestionKind;
  title: string;
  prompt: string;
  helper: string;
  targets: PlusMapTarget[];
  tokens: PlusToken[];
  correctAssignments: Record<string, string>;
  correctTargetIds: string[];
  correctTokenId: string | null;
  answerSummary: string;
  kpssNote: string;
  submitLabel: string;
  /** İl tahmin sorularında cevaptan sonra haritada vurgulanacak il adı. */
  revealProvinceName?: string;
};

export type PlusAvailability = {
  total: number;
  byTopic: Record<Exclude<PlusQuestionTopic, "mixed">, number>;
};

export const plusQuestionTopicOptions: Array<{ id: PlusQuestionTopic; label: string }> = [
  { id: "mixed", label: "Karma Soru+" },
  { id: "mine", label: "Madenler" },
  { id: "industry", label: "Sanayi" },
  { id: "energy", label: "Enerji" },
  { id: "agriculture", label: "Tarım" },
  { id: "livestock", label: "Hayvancılık" },
  { id: "mountain", label: "Dağlar" },
  { id: "river", label: "Akarsular" },
  { id: "lake", label: "Göller" },
  { id: "plainPlateau", label: "Ova / Plato" },
  { id: "coast", label: "Kıyı Tipleri" },
  { id: "tourism", label: "Turizm" },
  { id: "port", label: "Limanlar" },
  { id: "province", label: "İller" },
];

export const plusQuestionModeOptions: Array<{ id: PlusQuestionMode; label: string }> = [
  { id: "mixed", label: "Karma" },
  { id: "mapLocate", label: "Haritada Bul" },
  { id: "mapMatch", label: "Haritada Eşleştir" },
  { id: "placement", label: "Yerleştir" },
  { id: "pickOne", label: "Nokta Seç" },
  { id: "pickMany", label: "Çoklu Seç" },
  { id: "choice", label: "Liste" },
];

export const plusQuestionKindLabels: Record<PlusQuestionKind, string> = {
  mapLocate: "Haritada bul",
  mapMatch: "Haritada eşleştir",
  placement: "Yerleştir",
  pickOne: "Nokta seç",
  pickMany: "Çoklu seç",
  choice: "Liste",
};

const targetLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
const targetNumbers = ["1", "2", "3", "4", "5", "6", "7", "8"];

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

function featurePoint(feature: PlusFeature): PlusPoint | null {
  const [lng, lat] = feature.geometry.coordinates;

  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}

function featureName(feature: PlusFeature) {
  return isEconomicFeature(feature) ? getEconomicFeatureDisplayName(feature.properties) : feature.properties.name;
}

function featureDisplayName(feature: PlusFeature) {
  if (isEconomicFeature(feature)) {
    return getEconomicFeatureDisplayName(feature.properties);
  }

  const { location, name, region } = feature.properties;
  const duplicateFriendlyLocation = location && location !== region ? ` · ${location}` : "";

  return `${name}${duplicateFriendlyLocation}`;
}

function featurePromptName(feature: PlusFeature) {
  return feature.properties.name;
}

function featureDetail(feature: PlusFeature) {
  if (isEconomicFeature(feature)) {
    const location = getEconomicLocationShortLabel(feature.properties.location, true);

    return location ? `${feature.properties.categoryLabel} · ${location}` : feature.properties.categoryLabel;
  }

  return `${feature.properties.categoryLabel} · ${feature.properties.region}`;
}

function byId(features: PlusFeature[]) {
  return new Map(features.map((feature) => [feature.properties.id, feature]));
}

function getFeatures(features: PlusFeature[], ids: string[]) {
  const featureById = byId(features);
  const result: PlusFeature[] = [];

  for (const id of ids) {
    const feature = featureById.get(id);

    if (!feature || !featurePoint(feature)) {
      return null;
    }

    result.push(feature);
  }

  return result;
}

function mapTargets(features: PlusFeature[], labels = targetLetters, colors?: string[]) {
  return features.map((feature, index): PlusMapTarget => ({
    id: feature.properties.id,
    label: labels[index] ?? `${index + 1}`,
    point: featurePoint(feature) ?? { lat: 39, lng: 35 },
    name: featureName(feature),
    detail: featureDetail(feature),
    color: colors?.[index] ?? "#0f766e",
    markerIconName: getFeatureIconName(feature.properties),
  }));
}

function uniquePointFeatures(features: PlusFeature[]) {
  return uniqueBy(
    features.filter((feature) => featurePoint(feature)),
    (feature) => featureDisplayName(feature),
  );
}

function uniquePromptNameCandidates(features: PlusFeature[]) {
  const nameCounts = features.reduce<Record<string, number>>((counts, feature) => {
    const promptName = featurePromptName(feature);

    counts[promptName] = (counts[promptName] ?? 0) + 1;
    return counts;
  }, {});

  return features.filter(
    (feature) => Boolean(featurePoint(feature)) && nameCounts[featurePromptName(feature)] === 1,
  );
}

function isBroadRepresentativeFeature(feature: PlusFeature) {
  return isEconomicFeature(feature) && feature.properties.region.split("/").length > 1;
}

function mapLocateCandidates(features: PlusFeature[]) {
  return uniquePromptNameCandidates(features).filter((feature) => !isBroadRepresentativeFeature(feature));
}

function token(id: string, label: string, detail: string, color: string): PlusToken {
  return { id, label, detail, color };
}

function placementSummary(question: Pick<PlusQuestion, "targets" | "tokens" | "correctAssignments">) {
  const tokenById = new Map(question.tokens.map((item) => [item.id, item]));

  return question.targets
    .map((target) => {
      const answer = tokenById.get(question.correctAssignments[target.id]);

      return `${target.label}: ${answer?.label ?? "?"}`;
    })
    .join(", ");
}

function makePlacementQuestion(fields: Omit<PlusQuestion, "kind" | "correctTargetIds" | "correctTokenId" | "submitLabel">) {
  return {
    ...fields,
    kind: "placement",
    correctTargetIds: fields.targets.map((target) => target.id),
    correctTokenId: null,
    submitLabel: "Yerleştirmeyi kontrol et",
  } satisfies PlusQuestion;
}

function makeMapLocateQuestion(fields: Omit<PlusQuestion, "kind" | "correctAssignments" | "correctTokenId" | "submitLabel">) {
  return {
    ...fields,
    kind: "mapLocate",
    correctAssignments: {},
    correctTokenId: null,
    submitLabel: "Haritada işaretle",
  } satisfies PlusQuestion;
}

function makeMapMatchQuestion(fields: Omit<PlusQuestion, "kind" | "correctAssignments" | "submitLabel">) {
  return {
    ...fields,
    kind: "mapMatch",
    correctAssignments: {},
    submitLabel: "Cevabı seç",
  } satisfies PlusQuestion;
}

function makePickOneQuestion(fields: Omit<PlusQuestion, "kind" | "correctAssignments" | "correctTokenId" | "submitLabel">) {
  return {
    ...fields,
    kind: "pickOne",
    correctAssignments: {},
    correctTokenId: null,
    submitLabel: "Noktayı seç",
  } satisfies PlusQuestion;
}

function makePickManyQuestion(fields: Omit<PlusQuestion, "kind" | "correctAssignments" | "correctTokenId" | "submitLabel">) {
  return {
    ...fields,
    kind: "pickMany",
    correctAssignments: {},
    correctTokenId: null,
    submitLabel: "Seçimleri kontrol et",
  } satisfies PlusQuestion;
}

function makeChoiceQuestion(fields: Omit<PlusQuestion, "kind" | "correctAssignments" | "correctTargetIds" | "submitLabel">) {
  return {
    ...fields,
    kind: "choice",
    correctAssignments: {},
    correctTargetIds: fields.targets.map((target) => target.id),
    submitLabel: "Cevabı seç",
  } satisfies PlusQuestion;
}

function plusTopicFromFeature(feature: PlusFeature): Exclude<PlusQuestionTopic, "mixed"> | null {
  const topic = feature.properties.topic;

  if (
    topic === "mine" ||
    topic === "industry" ||
    topic === "energy" ||
    topic === "agriculture" ||
    topic === "livestock" ||
    topic === "mountain" ||
    topic === "river" ||
    topic === "lake" ||
    topic === "coast" ||
    topic === "tourism" ||
    topic === "port"
  ) {
    return topic;
  }

  if (topic === "plain" || topic === "plateau") {
    return "plainPlateau";
  }

  return null;
}

function buildMapLocateQuestions(features: PlusFeature[]) {
  return mapLocateCandidates(features)
    .map((feature): PlusQuestion | null => {
      const topic = plusTopicFromFeature(feature);

      if (!topic) {
        return null;
      }

      const promptName = featurePromptName(feature);
      const displayName = featureDisplayName(feature);

      return makeMapLocateQuestion({
        id: `plus_map_locate_${feature.properties.id}`,
        topic,
        title: "Konum tahmini",
        prompt: `${promptName} haritada nerededir?`,
        helper: "Haritaya tahmin noktanı bırak.",
        targets: mapTargets([feature], ["?"]),
        tokens: [],
        correctTargetIds: [feature.properties.id],
        answerSummary: `${displayName} doğru konum olarak gösterildi.`,
        kpssNote: feature.properties.kpssNote,
      });
    })
    .filter((question): question is PlusQuestion => Boolean(question));
}

function buildMapMatchQuestions(features: PlusFeature[]) {
  const candidates = uniquePromptNameCandidates(features);

  return candidates
    .map((feature): PlusQuestion | null => {
      const topic = plusTopicFromFeature(feature);

      if (!topic) {
        return null;
      }

      const promptName = featurePromptName(feature);
      const displayName = featureDisplayName(feature);
      const distractors = uniquePointFeatures(
        features.filter(
          (candidate) =>
            candidate.properties.id !== feature.properties.id &&
            candidate.properties.topic === feature.properties.topic &&
            featureDisplayName(candidate) !== displayName,
        ),
      );

      if (distractors.length < 4) {
        return null;
      }

      const targets = mapTargets(shuffle([feature, ...shuffle(distractors).slice(0, 4)]), targetLetters);
      const correctTarget = targets.find((target) => target.id === feature.properties.id);

      if (!correctTarget) {
        return null;
      }

      return makeMapMatchQuestion({
        id: `plus_map_match_${feature.properties.id}`,
        topic,
        title: "İşaretli nokta",
        prompt: `${promptName} hangi işaretli noktadadır?`,
        helper: "A-E işaretlerinden doğru konumu seç.",
        targets,
        tokens: targets.map((target) => token(target.id, `${target.label} noktası`, "", target.color)),
        correctTargetIds: [feature.properties.id],
        correctTokenId: feature.properties.id,
        answerSummary: `${correctTarget.label} noktası ${displayName} konumudur.`,
        kpssNote: feature.properties.kpssNote,
      });
    })
    .filter((question): question is PlusQuestion => Boolean(question));
}

function buildPointIdentifyQuestions(features: PlusFeature[]) {
  const candidates = uniquePromptNameCandidates(features).filter((feature) => !isBroadRepresentativeFeature(feature));

  return candidates
    .map((feature): PlusQuestion | null => {
      const topic = plusTopicFromFeature(feature);

      if (!topic) {
        return null;
      }

      const displayName = featureDisplayName(feature);
      const distractors = uniquePointFeatures(
        features.filter(
          (candidate) =>
            candidate.properties.id !== feature.properties.id &&
            candidate.properties.topic === feature.properties.topic &&
            featureDisplayName(candidate) !== displayName,
        ),
      );

      if (distractors.length < 4) {
        return null;
      }

      const options = shuffle([feature, ...shuffle(distractors).slice(0, 4)]);
      const topicLabel = feature.properties.topicLabel.toLocaleLowerCase("tr-TR");

      return makeChoiceQuestion({
        id: `plus_point_identify_${feature.properties.id}`,
        topic,
        title: "Bu nokta nedir?",
        prompt: `Haritada yanıp sönen ${topicLabel} noktası hangisidir?`,
        helper: "Noktanın konumuna bakıp doğru ismi listeden seç.",
        targets: mapTargets([feature], ["?"]),
        tokens: options.map((option) =>
          token(option.properties.id, featureDisplayName(option), featureDetail(option), "#0f766e"),
        ),
        correctTokenId: feature.properties.id,
        answerSummary: `${displayName} (${featureDetail(feature)})`,
        kpssNote: feature.properties.kpssNote,
      });
    })
    .filter((question): question is PlusQuestion => Boolean(question));
}

function buildCategoryOddOneOutQuestions(features: PlusFeature[]) {
  const pointFeatures = features.filter((feature) => Boolean(featurePoint(feature)) && plusTopicFromFeature(feature));
  const featuresByCategory = pointFeatures.reduce<Record<string, PlusFeature[]>>((groups, feature) => {
    const key = `${feature.properties.topic}__${feature.properties.category}`;

    groups[key] = [...(groups[key] ?? []), feature];
    return groups;
  }, {});

  return Object.entries(featuresByCategory)
    .map(([, categoryFeatures]): PlusQuestion | null => {
      const baseFeature = categoryFeatures[0];
      const topic = baseFeature ? plusTopicFromFeature(baseFeature) : null;

      if (!baseFeature || !topic) {
        return null;
      }

      const correctFeatures = uniquePointFeatures(categoryFeatures);
      const oddCandidates = uniquePointFeatures(
        pointFeatures.filter(
          (feature) =>
            feature.properties.topic === baseFeature.properties.topic &&
            feature.properties.category !== baseFeature.properties.category,
        ),
      );

      if (correctFeatures.length < 4 || oddCandidates.length < 1) {
        return null;
      }

      const oddFeature = shuffle(oddCandidates)[0];
      const targets = mapTargets(shuffle([...shuffle(correctFeatures).slice(0, 4), oddFeature]), targetLetters);
      const oddTarget = targets.find((target) => target.id === oddFeature.properties.id);

      if (!oddTarget) {
        return null;
      }

      return makePickOneQuestion({
        id: `plus_${baseFeature.properties.topic}_${baseFeature.properties.category}_odd_one_out`,
        topic,
        title: "Yanlış noktayı bul",
        prompt: `Haritada işaretli 5 ${baseFeature.properties.topicLabel.toLocaleLowerCase("tr-TR")} noktasından hangisi ${baseFeature.properties.categoryLabel} değildir?`,
        helper: "Dört işaret aynı gruptadır; farklı kategoride olan noktayı seç.",
        targets,
        tokens: [],
        correctTargetIds: [oddFeature.properties.id],
        answerSummary: `${oddTarget.label} noktası farklıdır: ${featureDisplayName(oddFeature)} ${oddFeature.properties.categoryLabel}.`,
        kpssNote: baseFeature.properties.kpssNote,
      });
    })
    .filter((question): question is PlusQuestion => Boolean(question));
}

function distributionPromptVerb(topic: Exclude<PlusQuestionTopic, "mixed">) {
  if (topic === "agriculture") {
    return "yetiştirilir";
  }

  if (topic === "livestock") {
    return "yapılır";
  }

  if (topic === "industry" || topic === "energy" || topic === "port" || topic === "tourism") {
    return "yer alır";
  }

  return "bulunur";
}

function buildRepeatedNameDistributionQuestions(features: PlusFeature[]) {
  const pointFeatures = features.filter((feature) => Boolean(featurePoint(feature)) && plusTopicFromFeature(feature));
  const featuresByName = pointFeatures.reduce<Record<string, PlusFeature[]>>((groups, feature) => {
    const key = `${feature.properties.topic}__${featurePromptName(feature)}`;

    groups[key] = [...(groups[key] ?? []), feature];
    return groups;
  }, {});

  return Object.entries(featuresByName)
    .map(([, nameFeatures]): PlusQuestion | null => {
      const baseFeature = nameFeatures[0];
      const topic = baseFeature ? plusTopicFromFeature(baseFeature) : null;

      if (!baseFeature || !topic) {
        return null;
      }

      const correctFeatures = uniquePointFeatures(nameFeatures);
      const distractors = uniquePointFeatures(
        pointFeatures.filter(
          (feature) =>
            feature.properties.topic === baseFeature.properties.topic &&
            featurePromptName(feature) !== featurePromptName(baseFeature),
        ),
      );

      if (correctFeatures.length < 2 || distractors.length < 3) {
        return null;
      }

      const selectedCorrectFeatures = shuffle(correctFeatures).slice(0, Math.min(correctFeatures.length, 4));
      const selectedDistractors = shuffle(distractors).slice(0, Math.max(3, 6 - selectedCorrectFeatures.length));
      const targets = mapTargets(shuffle([...selectedCorrectFeatures, ...selectedDistractors]), targetLetters);
      const correctTargetIds = selectedCorrectFeatures.map((feature) => feature.properties.id);
      const correctLabels = targets
        .filter((target) => correctTargetIds.includes(target.id))
        .map((target) => target.label)
        .join(", ");
      const promptName = featurePromptName(baseFeature);

      return makePickManyQuestion({
        id: `plus_${baseFeature.properties.id}_distribution_pick`,
        topic,
        title: "Dağılış noktaları",
        prompt: `İşaretli noktalardan hangilerinde ${promptName} ${distributionPromptVerb(topic)}?`,
        helper: "Birden fazla doğru nokta olabilir; aynı dağılışa ait işaretleri birlikte seç.",
        targets,
        tokens: [],
        correctTargetIds,
        answerSummary: `${promptName} için doğru işaretler: ${correctLabels}.`,
        kpssNote: baseFeature.properties.kpssNote,
      });
    })
    .filter((question): question is PlusQuestion => Boolean(question));
}

function buildMinePlacement(features: PlusFeature[]) {
  const ids = [
    "mine_demir_divrigi_sivas",
    "mine_bakir_murgul_artvin",
    "mine_bor_kirka_eskisehir",
    "mine_boksit_seydisehir_konya",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#6b7280", "#b45309", "#7c3aed", "#64748b"]);
  const tokens = shuffle([
    token("mineral_demir", "Demir", "Divriği", "#6b7280"),
    token("mineral_bakir", "Bakır", "Murgul", "#b45309"),
    token("mineral_bor", "Bor", "Kırka", "#7c3aed"),
    token("mineral_boksit", "Boksit", "Seydişehir", "#64748b"),
  ]);
  const correctAssignments: Record<string, string> = {
    mine_demir_divrigi_sivas: "mineral_demir",
    mine_bakir_murgul_artvin: "mineral_bakir",
    mine_bor_kirka_eskisehir: "mineral_bor",
    mine_boksit_seydisehir_konya: "mineral_boksit",
  };
  const question = makePlacementQuestion({
    id: "plus_mine_placement",
    topic: "mine",
    title: "Maden nokta atışı",
    prompt: "Maden ikonlarını doğru çıkarım alanlarına yerleştir.",
    helper: "Bir etiketi seçip haritadaki hedefe tıkla; istersen etiketi hedef noktanın üstüne sürükle.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "KPSS'de madenler çoğunlukla çıkarım merkeziyle birlikte sorulur: Divriği-demir, Murgul-bakır, Kırka-bor, Seydişehir-boksit.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildMineReverse(features: PlusFeature[]) {
  const pairs = [
    {
      targetId: "industry_bakir_isleme_murgul_artvin",
      correctTokenId: "reverse_bakir",
      label: "Bakır + bakır işleme",
      detail: "",
      color: "#b45309",
    },
    {
      targetId: "industry_bor_isleme_kirka_eskisehir",
      correctTokenId: "reverse_bor",
      label: "Bor + bor işleme",
      detail: "",
      color: "#7c3aed",
    },
    {
      targetId: "industry_aluminyum_seydisehir_konya",
      correctTokenId: "reverse_boksit",
      label: "Boksit + alüminyum",
      detail: "",
      color: "#64748b",
    },
    {
      targetId: "industry_petrol_rafinerisi_batman",
      correctTokenId: "reverse_petrol",
      label: "Petrol + rafineri",
      detail: "",
      color: "#111827",
    },
  ];
  const availablePairs = pairs.filter((pair) => getFeatures(features, [pair.targetId]));

  if (availablePairs.length < 4) {
    return null;
  }

  const selectedPair = shuffle(availablePairs)[0];
  const required = getFeatures(features, [selectedPair.targetId]);

  if (!required) {
    return null;
  }

  return makeChoiceQuestion({
    id: "plus_mine_reverse",
    topic: "mine",
    title: "Burada ne çıkar?",
    prompt: "Haritada yanıp sönen noktada hangi maden ve tesis eşleşmesi vardır?",
    helper: "Noktaya bakıp doğru maden-tesis ikilisini seç.",
    targets: mapTargets(required, ["?"])
      .map((target) => ({ ...target, color: selectedPair.color })),
    tokens: shuffle(pairs.map((pair) => token(pair.correctTokenId, pair.label, pair.detail, pair.color))),
    correctTokenId: selectedPair.correctTokenId,
    answerSummary: selectedPair.label,
    kpssNote: "Ters harita sorularında önce merkezin adını, sonra o merkezin maden/tesis eşleşmesini hatırlamak hız kazandırır.",
  });
}

function buildIndustryReason(features: PlusFeature[]) {
  const ids = [
    "industry_petrol_rafinerisi_batman",
    "industry_seker_fabrikasi_konya",
    "industry_cay_isleme_rize",
    "industry_demir_celik_iskenderun_hatay",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#111827", "#65a30d", "#16a34a", "#0f766e"]);

  return makePickOneQuestion({
    id: "plus_industry_reason",
    topic: "industry",
    title: "Kuruluş sebebini bul",
    prompt: "Haritadaki tesislerden hangisinin kuruluşunda hammaddeye yakınlık temel belirleyici değildir?",
    helper: "Batman petrol, Konya şeker ve Rize çay hammaddeye yakındır; liman/ulaşım etkisini ayırt et.",
    targets,
    tokens: [],
    correctTargetIds: ["industry_demir_celik_iskenderun_hatay"],
    answerSummary: "İskenderun demir-çelikte liman ve ulaşım etkisi öne çıkar.",
    kpssNote: "Sanayi sorularında kuruluş nedeni; hammadde, enerji, pazar ve ulaşım ayrımıyla sorulur.",
  });
}

function buildFactoryPlacement(features: PlusFeature[]) {
  const ids = [
    "industry_kagit_sanayi_caycuma_zonguldak",
    "industry_tekstil_adana",
    "agriculture_aycicegi_tekirdag",
    "industry_cay_isleme_rize",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#78716c", "#db2777", "#f59e0b", "#16a34a"]);
  const tokens = shuffle([
    token("factory_kagit", "Kağıt fabrikası", "Batı Karadeniz orman/su bağlantısı", "#78716c"),
    token("factory_pamuklu", "Pamuklu dokuma", "Çukurova pamuk alanı", "#db2777"),
    token("factory_yag", "Yağ fabrikası", "Trakya ayçiçeği alanı", "#f59e0b"),
    token("factory_cay", "Çay işleme", "Doğu Karadeniz çay alanı", "#16a34a"),
  ]);
  const correctAssignments: Record<string, string> = {
    industry_kagit_sanayi_caycuma_zonguldak: "factory_kagit",
    industry_tekstil_adana: "factory_pamuklu",
    agriculture_aycicegi_tekirdag: "factory_yag",
    industry_cay_isleme_rize: "factory_cay",
  };
  const question = makePlacementQuestion({
    id: "plus_factory_placement",
    topic: "industry",
    title: "Fabrika inşası",
    prompt: "Tesisleri hammaddeye en uygun harita noktalarına yerleştir.",
    helper: "Tesis adını seçip uygun hammadde/tesis noktasına bırak.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Tarımsal sanayi ve işleme tesisleri KPSS'de çoğunlukla hammadde alanlarıyla birlikte öğrenilir.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildLivestockSpecializationPlacement(features: PlusFeature[]) {
  const ids = [
    "livestock_aricilik_anzer_rize",
    "livestock_tiftik_kecisi_ankara",
    "livestock_kil_kecisi_taseli_platosu",
    "livestock_ipekbocekciligi_bursa",
    "livestock_kultur_balikciligi_mugla",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#8b5cf6", "#a16207", "#22c55e", "#dc2626", "#0ea5e9"]);
  const tokens = shuffle([
    token("livestock_bee", "Arıcılık", "Anzer / Rize", "#8b5cf6"),
    token("livestock_mohair", "Tiftik keçisi", "Ankara çevresi", "#a16207"),
    token("livestock_hair_goat", "Kıl keçisi", "Taşeli Platosu", "#22c55e"),
    token("livestock_silkworm", "İpek böcekçiliği", "Bursa", "#dc2626"),
    token("livestock_aquaculture", "Kültür balıkçılığı", "Muğla kıyıları", "#0ea5e9"),
  ]);
  const correctAssignments: Record<string, string> = {
    livestock_aricilik_anzer_rize: "livestock_bee",
    livestock_tiftik_kecisi_ankara: "livestock_mohair",
    livestock_kil_kecisi_taseli_platosu: "livestock_hair_goat",
    livestock_ipekbocekciligi_bursa: "livestock_silkworm",
    livestock_kultur_balikciligi_mugla: "livestock_aquaculture",
  };
  const question = makePlacementQuestion({
    id: "plus_livestock_specialization_placement",
    topic: "livestock",
    title: "Hayvancılık koşulları",
    prompt: "Hayvancılık örneklerini ayırt edici üretim alanlarıyla eşleştir.",
    helper: "Faaliyet adını seçip haritadaki doğru temsil noktasına yerleştir.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Hayvancılık sorularında mera, maki, kıyı, bitki çeşitliliği ve geleneksel üretim alanı birlikte düşünülür.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildMicroclimatePlacement(features: PlusFeature[]) {
  const ids = [
    "agriculture_pamuk_igdir_ovasi",
    "agriculture_turuncgil_rize",
    "agriculture_zeytin_yusufeli_artvin",
    "agriculture_muz_alanya_antalya",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#db2777", "#f97316", "#65a30d", "#eab308"]);
  const tokens = shuffle([
    token("crop_pamuk", "Pamuk", "Iğdır mikrokliması", "#db2777"),
    token("crop_turuncgil", "Turunçgil", "Rize mikrokliması", "#f97316"),
    token("crop_zeytin", "Zeytin", "Yusufeli mikrokliması", "#65a30d"),
    token("crop_muz", "Muz", "Alanya-Anamur kıyısı", "#eab308"),
  ]);
  const correctAssignments: Record<string, string> = {
    agriculture_pamuk_igdir_ovasi: "crop_pamuk",
    agriculture_turuncgil_rize: "crop_turuncgil",
    agriculture_zeytin_yusufeli_artvin: "crop_zeytin",
    agriculture_muz_alanya_antalya: "crop_muz",
  };
  const question = makePlacementQuestion({
    id: "plus_microclimate_placement",
    topic: "agriculture",
    title: "Mikroklima avcısı",
    prompt: "Mikroklima örneklerini doğru harita noktalarına yerleştir.",
    helper: "Ürünü seç ve haritadaki dar alan örneğine yerleştir.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Mikroklima soruları genel iklim bilgisine ters düşen dar alan örneklerini ayırt ettirir.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildWetCropPick(features: PlusFeature[]) {
  const correctIds = ["agriculture_cay_rize", "agriculture_cay_trabzon", "agriculture_cay_artvin"];
  const distractorIds = [
    "agriculture_pamuk_harran_sanliurfa",
    "agriculture_zeytin_aydin",
    "agriculture_turuncgil_antalya",
  ];
  const required = getFeatures(features, [...correctIds, ...distractorIds]);

  if (!required) {
    return null;
  }

  return makePickManyQuestion({
    id: "plus_wet_crop_pick",
    topic: "agriculture",
    title: "Ürün dağılışını seç",
    prompt: "Her mevsim yağış isteyen çay tarımının haritadaki noktalarını seç.",
    helper: "Doğu Karadeniz kıyı şeridindeki çay noktalarını işaretle.",
    targets: mapTargets(shuffle(required), targetLetters),
    tokens: [],
    correctTargetIds: correctIds,
    answerSummary: "Çay için Rize, Trabzon ve Artvin noktaları seçilmelidir.",
    kpssNote: "Çay, yaz kuraklığından olumsuz etkilendiği için Doğu Karadeniz'in bol yağışlı kıyı kesiminde toplanır.",
  });
}

function buildOilPlantPlacement(features: PlusFeature[]) {
  const ids = [
    "agriculture_aycicegi_tekirdag",
    "agriculture_zeytin_aydin",
    "agriculture_soya_adana",
    "agriculture_hashas_afyonkarahisar",
    "agriculture_yer_fistigi_osmaniye",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#f59e0b", "#65a30d", "#22c55e", "#7c3aed", "#a16207"]);
  const tokens = shuffle([
    token("oil_crop_sunflower", "Ayçiçeği", "Trakya", "#f59e0b"),
    token("oil_crop_olive", "Zeytin", "Ege kıyıları", "#65a30d"),
    token("oil_crop_soybean", "Soya", "Çukurova", "#22c55e"),
    token("oil_crop_poppy", "Haşhaş", "İç Batı Anadolu", "#7c3aed"),
    token("oil_crop_peanut", "Yer fıstığı", "Çukurova çevresi", "#a16207"),
  ]);
  const correctAssignments: Record<string, string> = {
    agriculture_aycicegi_tekirdag: "oil_crop_sunflower",
    agriculture_zeytin_aydin: "oil_crop_olive",
    agriculture_soya_adana: "oil_crop_soybean",
    agriculture_hashas_afyonkarahisar: "oil_crop_poppy",
    agriculture_yer_fistigi_osmaniye: "oil_crop_peanut",
  };
  const question = makePlacementQuestion({
    id: "plus_oil_plant_placement",
    topic: "agriculture",
    title: "Yağ bitkileri haritası",
    prompt: "Yağ bitkilerini doğru üretim alanlarıyla eşleştir.",
    helper: "Ürün adını seçip KPSS'de öne çıkan temsil noktasına yerleştir.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Yağ bitkilerinde ayçiçeği-Trakya, zeytin-Ege, soya-Çukurova, haşhaş-İç Batı Anadolu ve yer fıstığı-Çukurova eşleştirmeleri öne çıkar.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildVolcanicMountainPick(features: PlusFeature[]) {
  const correctIds = [
    "mountain_erciyes_dagi",
    "mountain_hasandagi",
    "mountain_nemrut",
    "mountain_agri_buyuk_ve_kucuk_agri",
  ].filter((id) => getFeatures(features, [id]));
  const fallbackCorrectIds = ["mountain_erciyes_dagi", "mountain_hasandagi", "mountain_nemrut", "mountain_buyuk_agri"].filter(
    (id) => getFeatures(features, [id]),
  );
  const finalCorrectIds = correctIds.length >= 3 ? correctIds : fallbackCorrectIds;
  const distractorIds = ["mountain_kure_daglari", "mountain_kaz_daglari", "mountain_aydin_daglari"];
  const required = getFeatures(features, [...finalCorrectIds, ...distractorIds]);

  if (!required || finalCorrectIds.length < 3) {
    return null;
  }

  return makePickManyQuestion({
    id: "plus_volcanic_mountain_pick",
    topic: "mountain",
    title: "Volkanik hat boyama",
    prompt: "İşaretli dağlar içinden volkanik olanları seç.",
    helper: "İç Anadolu ve Doğu Anadolu'daki volkanik dağ noktalarını ayıkla.",
    targets: mapTargets(shuffle(required), targetLetters),
    tokens: [],
    correctTargetIds: finalCorrectIds,
    answerSummary: "Volkanik dağlar seçilmelidir: Erciyes, Hasan, Nemrut ve Ağrı hattı.",
    kpssNote: "KPSS'de volkanik dağlar İç Anadolu ve Doğu Anadolu'daki hatlarla birlikte sorulur.",
  });
}

function buildNorthAnatolianMountainPick(features: PlusFeature[]) {
  const correctIds = [
    "mountain_kure_daglari",
    "mountain_canik_daglari",
    "mountain_giresun_daglari",
    "mountain_kackar_daglari",
  ];
  const distractorIds = ["mountain_amanos_nur_daglari", "mountain_bey_daglari", "mountain_mentese_daglari"];
  const required = getFeatures(features, [...correctIds, ...distractorIds]);

  if (!required) {
    return null;
  }

  return makePickManyQuestion({
    id: "plus_north_anatolian_mountain_pick",
    topic: "mountain",
    title: "Kuzey kıyı dağları",
    prompt: "İşaretli dağlardan Kuzey Anadolu kıyı dağları içinde yer alanları seç.",
    helper: "Karadeniz kıyısına paralel uzanan dağları ayıkla.",
    targets: mapTargets(shuffle(required), targetLetters),
    tokens: [],
    correctTargetIds: correctIds,
    answerSummary: "Küre, Canik, Giresun ve Kaçkar dağları seçilmelidir.",
    kpssNote: "Kuzey Anadolu Dağları Karadeniz kıyısına paralel uzanır; Akdeniz ve Ege dağlarıyla karıştırılmamalıdır.",
  });
}

function buildFaultMountainPlacement(features: PlusFeature[]) {
  const ids = [
    "mountain_kaz_daglari",
    "mountain_madra_dagi",
    "mountain_yunt_dagi",
    "mountain_bozdaglar",
    "mountain_aydin_daglari",
    "mountain_mentese_daglari",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const sortedNorthSouth = [...required].sort((left, right) => {
    const leftPoint = featurePoint(left);
    const rightPoint = featurePoint(right);

    return (rightPoint?.lat ?? 0) - (leftPoint?.lat ?? 0);
  });
  const targets = mapTargets(sortedNorthSouth, targetNumbers, ["#7c3aed", "#7c3aed", "#7c3aed", "#7c3aed", "#7c3aed", "#7c3aed"]);
  const tokens = shuffle(
    sortedNorthSouth.map((feature) =>
      token(feature.properties.id, feature.properties.name, "Ege kırık dağı", "#7c3aed"),
    ),
  );
  const correctAssignments = Object.fromEntries(sortedNorthSouth.map((feature) => [feature.properties.id, feature.properties.id]));
  const question = makePlacementQuestion({
    id: "plus_fault_mountain_placement",
    topic: "mountain",
    title: "Kırık dağ sıralaması",
    prompt: "Ege'nin kırık dağlarını kuzeyden güneye doğru haritadaki boşluklara yerleştir.",
    helper: "1 numara en kuzeyde, 6 numara en güneyde olacak şekilde dağ adlarını yerleştir.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Ege horst-graben sisteminde dağlar kuzeyden güneye Kaz, Madra, Yunt, Bozdağlar, Aydın ve Menteşe şeklinde öğrenilir.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildCoastTypePlacement(features: PlusFeature[]) {
  const ids = [
    "coast_karadeniz_boyuna_kiyilari",
    "coast_ege_enine_kiyilari",
    "coast_istanbul_bogazi",
    "coast_kas_finike_arasi",
    "coast_buyuk_cekmece_kiyilari",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#f59e0b", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6"]);
  const tokens = shuffle([
    token("coast_type_boyuna", "Boyuna kıyı", "Karadeniz dağları kıyıya paralel", "#f59e0b"),
    token("coast_type_enine", "Enine kıyı", "Ege dağları kıyıya dik", "#0ea5e9"),
    token("coast_type_ria", "Ria kıyı", "Boğaz ve eski vadi ağzı", "#8b5cf6"),
    token("coast_type_dalmatian", "Dalmaçya kıyı", "Kaş-Finike arası", "#ec4899"),
    token("coast_type_limanli", "Limanlı kıyı", "Kıyı setiyle kapanan koy", "#14b8a6"),
  ]);
  const correctAssignments: Record<string, string> = {
    coast_karadeniz_boyuna_kiyilari: "coast_type_boyuna",
    coast_ege_enine_kiyilari: "coast_type_enine",
    coast_istanbul_bogazi: "coast_type_ria",
    coast_kas_finike_arasi: "coast_type_dalmatian",
    coast_buyuk_cekmece_kiyilari: "coast_type_limanli",
  };
  const question = makePlacementQuestion({
    id: "plus_coast_type_placement",
    topic: "coast",
    title: "Kıyı tipi okuma",
    prompt: "Kıyı tiplerini Türkiye'deki temsil alanlarıyla eşleştir.",
    helper: "Kıyı tipini seçip haritadaki doğru örnek noktaya yerleştir.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Kıyı tipleri dağların uzanışı, eski vadilerin sular altında kalması ve kıyı setlenmesiyle ayırt edilir.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildRiverBasinPlacement(features: PlusFeature[]) {
  const ids = ["river_kizilirmak", "river_gediz_nehri", "river_seyhan_nehri", "river_firat_nehri", "river_aras_nehri"];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#0284c7", "#0ea5e9", "#06b6d4", "#2563eb", "#0891b2"]);
  const tokens = shuffle([
    token("basin_black_sea", "Karadeniz", "Kızılırmak", "#0284c7"),
    token("basin_aegean", "Ege Denizi", "Gediz", "#0ea5e9"),
    token("basin_mediterranean", "Akdeniz", "Seyhan", "#06b6d4"),
    token("basin_persian_gulf", "Basra Körfezi", "Fırat", "#2563eb"),
    token("basin_caspian", "Hazar Denizi", "Aras", "#0891b2"),
  ]);
  const correctAssignments: Record<string, string> = {
    river_kizilirmak: "basin_black_sea",
    river_gediz_nehri: "basin_aegean",
    river_seyhan_nehri: "basin_mediterranean",
    river_firat_nehri: "basin_persian_gulf",
    river_aras_nehri: "basin_caspian",
  };
  const question = makePlacementQuestion({
    id: "plus_river_basin_placement",
    topic: "river",
    title: "Akarsu dökülme alanı",
    prompt: "Akarsuları döküldükleri deniz ya da havzayla eşleştir.",
    helper: "Havza adını seçip ilgili akarsu noktasına yerleştir.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Akarsular KPSS'de yalnızca konumla değil, döküldükleri deniz ya da kapalı dış havza bağlantısıyla da sorulur.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildDamRiverPlacement(features: PlusFeature[]) {
  const ids = [
    "energy_ataturk_hes_bozova_sanliurfa",
    "energy_deriner_hes_artvin_coruh",
    "energy_hirfanli_hes_kaman_kirsehir",
    "energy_oymapinar_hes_manavgat_antalya",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#2563eb", "#0284c7", "#0d9488", "#0891b2"]);
  const tokens = shuffle([
    token("river_firat", "Fırat", "Atatürk HES", "#2563eb"),
    token("river_coruh", "Çoruh", "Deriner HES", "#0284c7"),
    token("river_kizilirmak", "Kızılırmak", "Hirfanlı HES", "#0d9488"),
    token("river_manavgat", "Manavgat", "Oymapınar HES", "#0891b2"),
  ]);
  const correctAssignments: Record<string, string> = {
    energy_ataturk_hes_bozova_sanliurfa: "river_firat",
    energy_deriner_hes_artvin_coruh: "river_coruh",
    energy_hirfanli_hes_kaman_kirsehir: "river_kizilirmak",
    energy_oymapinar_hes_manavgat_antalya: "river_manavgat",
  };
  const question = makePlacementQuestion({
    id: "plus_dam_river_placement",
    topic: "river",
    title: "Akarsu - baraj eşleştirme",
    prompt: "Baraj/HES noktalarını ilgili akarsuyla eşleştir.",
    helper: "Akarsu adını seçip doğru HES noktasına yerleştir.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Enerji barajlarında Fırat, Çoruh, Kızılırmak ve Manavgat eşleştirmeleri KPSS harita sorularında öne çıkar.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildKarsticLakePick(features: PlusFeature[]) {
  const correctIds = ["lake_salda_golu", "lake_kestel_golu", "lake_avlan_golu", "lake_sugla_golu"];
  const distractorIds = ["lake_tuz_golu", "lake_iznik_golu", "lake_van_golu"];
  const required = getFeatures(features, [...correctIds, ...distractorIds]);

  if (!required) {
    return null;
  }

  return makePickManyQuestion({
    id: "plus_karstic_lake_pick",
    topic: "lake",
    title: "Karstik gölleri bul",
    prompt: "İşaretli göllerden karstik oluşumlu olanları seç.",
    helper: "Göller Yöresi ve kalker arazi ilişkisini kullan.",
    targets: mapTargets(shuffle(required), targetLetters),
    tokens: [],
    correctTargetIds: correctIds,
    answerSummary: "Salda, Kestel, Avlan ve Suğla karstik göl örnekleridir.",
    kpssNote: "Karstik göller, kalkerli arazinin çözünmesiyle oluşur; KPSS'de özellikle Göller Yöresi çevresiyle sorulur.",
  });
}

function buildCoastalSetLakePick(features: PlusFeature[]) {
  const correctIds = ["lake_buyuk_cekmece", "lake_kucuk_cekmece", "lake_terkos_durusu", "lake_akyatan_golu"];
  const distractorIds = ["lake_van_golu", "lake_tuz_golu", "lake_salda_golu"];
  const required = getFeatures(features, [...correctIds, ...distractorIds]);

  if (!required) {
    return null;
  }

  return makePickManyQuestion({
    id: "plus_coastal_set_lake_pick",
    topic: "lake",
    title: "Kıyı set gölleri",
    prompt: "İşaretli göllerden kıyı set gölü olanları seç.",
    helper: "Deniz kıyısında setlenmeyle oluşan gölleri, iç kesim göllerinden ayır.",
    targets: mapTargets(shuffle(required), targetLetters),
    tokens: [],
    correctTargetIds: correctIds,
    answerSummary: "Büyükçekmece, Küçükçekmece, Terkos/Durusu ve Akyatan kıyı set gölüdür.",
    kpssNote: "Kıyı set gölleri, kıyı oku veya setlerin eski koy/lagün alanlarını kapatmasıyla oluşur.",
  });
}

function buildLakeNamePlacement(features: PlusFeature[]) {
  const ids = ["lake_tuz_golu", "lake_van_golu", "lake_iznik_golu", "lake_manyas_kus_golu", "lake_burdur_golu"];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#2563eb", "#f97316", "#0891b2", "#06b6d4", "#14b8a6"]);
  const tokens = shuffle(
    required.map((feature) => token(feature.properties.id, feature.properties.name, feature.properties.categoryLabel, "#0891b2")),
  );
  const correctAssignments = Object.fromEntries(required.map((feature) => [feature.properties.id, feature.properties.id]));
  const question = makePlacementQuestion({
    id: "plus_lake_name_placement",
    topic: "lake",
    title: "Göl adını yerleştir",
    prompt: "Göl adlarını haritadaki doğru noktalara yerleştir.",
    helper: "Etiketi seç ve doğru göl noktasına bırak.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Göl sorularında hem konum hem oluşum türü birlikte sorulabilir.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildDeltaPlainPick(features: PlusFeature[]) {
  const correctIds = ["plain_cukurova", "plain_bafra_ovasi", "plain_carsamba_ovasi", "plain_balat_ovasi"];
  const distractorIds = ["plain_konya_ovasi", "plain_harran_altinbasak_ovasi", "plain_kestel_ovasi"];
  const required = getFeatures(features, [...correctIds, ...distractorIds]);

  if (!required) {
    return null;
  }

  return makePickManyQuestion({
    id: "plus_delta_plain_pick",
    topic: "plainPlateau",
    title: "Delta ovalarını belirle",
    prompt: "İşaretli ovalardan delta ovası olanları seç.",
    helper: "Kıyıda, akarsu alüvyonlarının denizi doldurmasıyla oluşan ovaları ayıkla.",
    targets: mapTargets(shuffle(required), targetLetters),
    tokens: [],
    correctTargetIds: correctIds,
    answerSummary: "Çukurova, Bafra, Çarşamba ve Balat delta ovasıdır.",
    kpssNote: "Delta ovaları kıyıda gelişir; iç kesimdeki tektonik veya karstik ovalarla karıştırılmamalıdır.",
  });
}

function buildAegeanGrabenPlainPick(features: PlusFeature[]) {
  const correctIds = ["plain_akhisar_ovasi", "plain_salihli_ovasi", "plain_alasehir_ovasi", "plain_nazilli_ovasi"];
  const distractorIds = ["plain_bafra_ovasi", "plain_cukurova", "plain_konya_ovasi"];
  const required = getFeatures(features, [...correctIds, ...distractorIds]);

  if (!required) {
    return null;
  }

  return makePickManyQuestion({
    id: "plus_aegean_graben_plain_pick",
    topic: "plainPlateau",
    title: "Ege graben ovaları",
    prompt: "İşaretli ovalardan Ege'nin doğu-batı uzanışlı graben sistemiyle ilişkili olanları seç.",
    helper: "Gediz ve Büyük Menderes olukları çevresindeki iç Ege ovalarını ayıkla.",
    targets: mapTargets(shuffle(required), targetLetters),
    tokens: [],
    correctTargetIds: correctIds,
    answerSummary: "Akhisar, Salihli, Alaşehir ve Nazilli ovaları Ege graben sistemiyle ilişkilidir.",
    kpssNote: "Ege'de horst-graben yapısı dağ ve ova dizilişini belirler; ovalar doğu-batı yönlü uzanışla sorulabilir.",
  });
}

function buildPlateauEconomyPlacement(features: PlusFeature[]) {
  const ids = [
    "plateau_erzurum_kars_platosu",
    "plateau_catalca_kocaeli_platosu",
    "plateau_taseli_platosu",
    "plateau_bozok_platosu",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#ef4444", "#9333ea", "#22c55e", "#f59e0b"]);
  const tokens = shuffle([
    token("economy_bigbas", "Büyükbaş hayvancılık", "Erzurum-Kars", "#ef4444"),
    token("economy_sanayi", "Sanayi / hizmet", "Çatalca-Kocaeli", "#9333ea"),
    token("economy_kil_kecisi", "Kıl keçisi", "Taşeli", "#22c55e"),
    token("economy_tahil", "Tahıl tarımı", "Bozok", "#f59e0b"),
  ]);
  const correctAssignments: Record<string, string> = {
    plateau_erzurum_kars_platosu: "economy_bigbas",
    plateau_catalca_kocaeli_platosu: "economy_sanayi",
    plateau_taseli_platosu: "economy_kil_kecisi",
    plateau_bozok_platosu: "economy_tahil",
  };
  const question = makePlacementQuestion({
    id: "plus_plateau_economy_placement",
    topic: "plainPlateau",
    title: "Plato ekonomisi",
    prompt: "Platoları baskın ekonomik faaliyetlerle eşleştir.",
    helper: "Faaliyeti seçip doğru plato noktasına yerleştir.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Platolar KPSS'de hem oluşum/yükselti hem de ekonomik faaliyet ilişkisiyle sorulur.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildCoreCropPlacement(features: PlusFeature[]) {
  const ids = [
    "agriculture_bugday_konya",
    "agriculture_pamuk_harran_sanliurfa",
    "agriculture_aycicegi_tekirdag",
    "agriculture_findik_ordu",
    "agriculture_cay_rize",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#ca8a04", "#db2777", "#f59e0b", "#84cc16", "#16a34a"]);
  const tokens = shuffle([
    token("core_crop_bugday", "Buğday", "", "#ca8a04"),
    token("core_crop_pamuk", "Pamuk", "", "#db2777"),
    token("core_crop_aycicegi", "Ayçiçeği", "", "#f59e0b"),
    token("core_crop_findik", "Fındık", "", "#84cc16"),
    token("core_crop_cay", "Çay", "", "#16a34a"),
  ]);
  const correctAssignments: Record<string, string> = {
    agriculture_bugday_konya: "core_crop_bugday",
    agriculture_pamuk_harran_sanliurfa: "core_crop_pamuk",
    agriculture_aycicegi_tekirdag: "core_crop_aycicegi",
    agriculture_findik_ordu: "core_crop_findik",
    agriculture_cay_rize: "core_crop_cay",
  };
  const question = makePlacementQuestion({
    id: "plus_core_crop_placement",
    topic: "agriculture",
    title: "Temel ürün dağılışı",
    prompt: "Temel tarım ürünlerini doğru dağılış noktalarına yerleştir.",
    helper: "Ürün adını seçip haritadaki uygun noktaya bırak.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Temel ürün dağılışında buğday-karasal alan, pamuk-GAP/Çukurova/Ege, ayçiçeği-Trakya, fındık ve çay-Doğu Karadeniz ilişkisi öne çıkar.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildSpecialMinePlacement(features: PlusFeature[]) {
  const ids = [
    "mine_luletasi_eskisehir",
    "mine_oltu_tasi_oltu_erzurum",
    "mine_zimpara_tasi_milas_mugla",
    "mine_mermer_afyonkarahisar",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#7c3aed", "#111827", "#64748b", "#94a3b8"]);
  const tokens = shuffle([
    token("special_mine_luletasi", "Lületaşı", "", "#7c3aed"),
    token("special_mine_oltu", "Oltu taşı", "", "#111827"),
    token("special_mine_zimpara", "Zımpara taşı", "", "#64748b"),
    token("special_mine_mermer", "Mermer", "", "#94a3b8"),
  ]);
  const correctAssignments: Record<string, string> = {
    mine_luletasi_eskisehir: "special_mine_luletasi",
    mine_oltu_tasi_oltu_erzurum: "special_mine_oltu",
    mine_zimpara_tasi_milas_mugla: "special_mine_zimpara",
    mine_mermer_afyonkarahisar: "special_mine_mermer",
  };
  const question = makePlacementQuestion({
    id: "plus_special_mine_placement",
    topic: "mine",
    title: "Yerel maden eşleşmesi",
    prompt: "Yerel/ayırt edici maden örneklerini doğru noktalara yerleştir.",
    helper: "Maden adını seçip haritadaki uygun noktaya bırak.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Lületaşı, Oltu taşı, zımpara taşı ve mermer KPSS'de yerel maden örnekleri olarak eşleştirilebilir.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildLakeFormationPlacement(features: PlusFeature[]) {
  const ids = ["lake_tuz_golu", "lake_salda_golu", "lake_nemrut_kaldera", "lake_buyuk_cekmece"];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#2563eb", "#22c55e", "#ef4444", "#06b6d4"]);
  const tokens = shuffle([
    token("lake_form_tectonic", "Tektonik göl", "", "#2563eb"),
    token("lake_form_karstic", "Karstik göl", "", "#22c55e"),
    token("lake_form_volcanic", "Volkanik göl", "", "#ef4444"),
    token("lake_form_coastal", "Kıyı set gölü", "", "#06b6d4"),
  ]);
  const correctAssignments: Record<string, string> = {
    lake_tuz_golu: "lake_form_tectonic",
    lake_salda_golu: "lake_form_karstic",
    lake_nemrut_kaldera: "lake_form_volcanic",
    lake_buyuk_cekmece: "lake_form_coastal",
  };
  const question = makePlacementQuestion({
    id: "plus_lake_formation_placement",
    topic: "lake",
    title: "Göl oluşum türü",
    prompt: "Göl oluşum türlerini doğru harita noktalarıyla eşleştir.",
    helper: "Oluşum türünü seçip uygun göl noktasına bırak.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Göller KPSS'de çoğunlukla oluşum türleriyle sorulur: tektonik, karstik, volkanik ve kıyı set ayrımı önemlidir.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildInnerPlateauPick(features: PlusFeature[]) {
  const correctIds = [
    "plateau_haymana_platosu",
    "plateau_cihanbeyli_platosu",
    "plateau_obruk_platosu",
    "plateau_bozok_platosu",
  ];
  const distractorIds = ["plateau_taseli_platosu", "plateau_erzurum_kars_platosu", "plateau_catalca_kocaeli_platosu"];
  const required = getFeatures(features, [...correctIds, ...distractorIds]);

  if (!required) {
    return null;
  }

  return makePickManyQuestion({
    id: "plus_inner_plateau_pick",
    topic: "plainPlateau",
    title: "İç Anadolu platoları",
    prompt: "İşaretli platolardan İç Anadolu çevresinde yer alanları seç.",
    helper: "İç kesimde toplanan plato noktalarını işaretle.",
    targets: mapTargets(shuffle(required), targetLetters),
    tokens: [],
    correctTargetIds: correctIds,
    answerSummary: "Haymana, Cihanbeyli, Obruk ve Bozok platoları seçilmelidir.",
    kpssNote: "İç Anadolu platoları konum sorularında sık sorulur; Taşeli, Erzurum-Kars ve Çatalca-Kocaeli ile karıştırılmamalıdır.",
  });
}

function buildTourismAttractionPlacement(features: PlusFeature[]) {
  const ids = [
    "tourism_kultur_turizmi_goreme_kapadokya_nevsehir",
    "tourism_kultur_turizmi_efes_selcuk_izmir",
    "tourism_kultur_turizmi_pamukkale_denizli",
    "tourism_kis_turizmi_palandoken_erzurum",
    "tourism_termal_turizm_afyonkarahisar",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#9333ea", "#7c3aed", "#14b8a6", "#2563eb", "#ef4444"]);
  const tokens = shuffle([
    token("tourism_cappadocia", "Peribacaları", "Kapadokya / Nevşehir", "#9333ea"),
    token("tourism_ephesus", "Antik kent", "Efes / Selçuk", "#7c3aed"),
    token("tourism_pamukkale", "Traverten", "Pamukkale / Denizli", "#14b8a6"),
    token("tourism_palandoken", "Kış turizmi", "Palandöken / Erzurum", "#2563eb"),
    token("tourism_afyon", "Termal turizm", "Afyonkarahisar", "#ef4444"),
  ]);
  const correctAssignments: Record<string, string> = {
    tourism_kultur_turizmi_goreme_kapadokya_nevsehir: "tourism_cappadocia",
    tourism_kultur_turizmi_efes_selcuk_izmir: "tourism_ephesus",
    tourism_kultur_turizmi_pamukkale_denizli: "tourism_pamukkale",
    tourism_kis_turizmi_palandoken_erzurum: "tourism_palandoken",
    tourism_termal_turizm_afyonkarahisar: "tourism_afyon",
  };
  const question = makePlacementQuestion({
    id: "plus_tourism_attraction_placement",
    topic: "tourism",
    title: "Turizm çekiciliği",
    prompt: "Turizm merkezlerini ayırt edici çekicilikleriyle eşleştir.",
    helper: "Çekiciliği seçip haritadaki doğru turizm noktasına yerleştir.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Turizm sorularında merkez adı kadar çekicilik türü de sorulur: kültür, kıyı, kış, termal ve doğal oluşum ayrımı önemlidir.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildPortHinterlandPlacement(features: PlusFeature[]) {
  const ids = [
    "port_mersin_limani_mersin",
    "port_izmir_limani_izmir",
    "port_iskenderun_limani_iskenderun_hatay",
    "port_samsun_limani_samsun",
    "port_bandirma_limani_bandirma_balikesir",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#0284c7", "#0ea5e9", "#2563eb", "#14b8a6", "#0f766e"]);
  const tokens = shuffle([
    token("port_mersin_hinterland", "Çukurova-GAP çıkışı", "Mersin", "#0284c7"),
    token("port_izmir_hinterland", "Ege ihracat limanı", "İzmir", "#0ea5e9"),
    token("port_iskenderun_hinterland", "Doğu Akdeniz sanayi", "İskenderun", "#2563eb"),
    token("port_samsun_hinterland", "Orta Karadeniz bağlantısı", "Samsun", "#14b8a6"),
    token("port_bandirma_hinterland", "Güney Marmara çıkışı", "Bandırma", "#0f766e"),
  ]);
  const correctAssignments: Record<string, string> = {
    port_mersin_limani_mersin: "port_mersin_hinterland",
    port_izmir_limani_izmir: "port_izmir_hinterland",
    port_iskenderun_limani_iskenderun_hatay: "port_iskenderun_hinterland",
    port_samsun_limani_samsun: "port_samsun_hinterland",
    port_bandirma_limani_bandirma_balikesir: "port_bandirma_hinterland",
  };
  const question = makePlacementQuestion({
    id: "plus_port_hinterland_placement",
    topic: "port",
    title: "Liman hinterlandı",
    prompt: "Limanları hizmet ettikleri başlıca hinterlandlarla eşleştir.",
    helper: "Hinterland ifadesini seçip doğru liman noktasına yerleştir.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Liman sorularında konum kadar hinterland, ulaşım bağlantısı ve sanayi/tarım çıkışı da belirleyicidir.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildRawMaterialIndustryPlacement(features: PlusFeature[]) {
  const ids = [
    "industry_seker_fabrikasi_konya",
    "industry_cay_isleme_rize",
    "industry_findik_isleme_ordu",
    "industry_zeytinyagi_aydin",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#65a30d", "#16a34a", "#84cc16", "#a3e635"]);
  const tokens = shuffle([
    token("raw_sugar_beet", "Şeker pancarı", "", "#65a30d"),
    token("raw_tea", "Çay", "", "#16a34a"),
    token("raw_hazelnut", "Fındık", "", "#84cc16"),
    token("raw_olive", "Zeytin", "", "#a3e635"),
  ]);
  const correctAssignments: Record<string, string> = {
    industry_seker_fabrikasi_konya: "raw_sugar_beet",
    industry_cay_isleme_rize: "raw_tea",
    industry_findik_isleme_ordu: "raw_hazelnut",
    industry_zeytinyagi_aydin: "raw_olive",
  };
  const question = makePlacementQuestion({
    id: "plus_raw_material_industry_placement",
    topic: "industry",
    title: "Hammadde - tesis",
    prompt: "Tarımsal hammaddeleri doğru işleme tesisleriyle eşleştir.",
    helper: "Hammadde adını seçip uygun tesis noktasına bırak.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Tarımsal sanayide kuruluş yeri çoğu zaman hammaddeye yakınlıkla açıklanır.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildRenewableEnergyPlacement(features: PlusFeature[]) {
  const ids = [
    "energy_jeotermal_enerji_kizildere_saraykoy_denizli",
    "energy_ruzgar_enerjisi_alacati_cesme_izmir",
    "energy_gunes_enerjisi_karapinar_konya",
    "energy_deriner_hes_artvin_coruh",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#ef4444", "#0ea5e9", "#facc15", "#2563eb"]);
  const tokens = shuffle([
    token("renewable_geothermal", "Jeotermal", "Kızıldere / Denizli", "#ef4444"),
    token("renewable_wind", "Rüzgar", "Alaçatı / Çeşme", "#0ea5e9"),
    token("renewable_solar", "Güneş", "Karapınar / Konya", "#facc15"),
    token("renewable_hydro", "Hidroelektrik", "Deriner / Çoruh", "#2563eb"),
  ]);
  const correctAssignments: Record<string, string> = {
    energy_jeotermal_enerji_kizildere_saraykoy_denizli: "renewable_geothermal",
    energy_ruzgar_enerjisi_alacati_cesme_izmir: "renewable_wind",
    energy_gunes_enerjisi_karapinar_konya: "renewable_solar",
    energy_deriner_hes_artvin_coruh: "renewable_hydro",
  };
  const question = makePlacementQuestion({
    id: "plus_renewable_energy_placement",
    topic: "energy",
    title: "Yenilenebilir enerji noktaları",
    prompt: "Yenilenebilir enerji türlerini doğru temsil noktalarıyla eşleştir.",
    helper: "Enerji türünü seçip uygun harita noktasına yerleştir.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Yenilenebilir enerji sorularında jeotermal Batı Anadolu grabenleriyle, rüzgar Ege-Marmara kıyılarıyla, güneş iç ve güney kesimlerle ilişkilendirilir.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildEnergyResourcePlacement(features: PlusFeature[]) {
  const ids = [
    "energy_taskomuru_zonguldak",
    "energy_linyit_soma_manisa",
    "energy_petrol_batman",
    "energy_dogal_gaz_hamitabat_kirklareli",
    "energy_gunes_enerjisi_karapinar_konya",
  ];
  const required = getFeatures(features, ids);

  if (!required) {
    return null;
  }

  const targets = mapTargets(shuffle(required), targetLetters, ["#111827", "#a16207", "#ea580c", "#0f766e", "#facc15"]);
  const tokens = shuffle([
    token("energy_coal", "Taş kömürü", "", "#111827"),
    token("energy_lignite", "Linyit", "", "#a16207"),
    token("energy_oil", "Petrol", "", "#ea580c"),
    token("energy_gas", "Doğal gaz", "", "#0f766e"),
    token("energy_solar", "Güneş enerjisi", "", "#facc15"),
  ]);
  const correctAssignments: Record<string, string> = {
    energy_taskomuru_zonguldak: "energy_coal",
    energy_linyit_soma_manisa: "energy_lignite",
    energy_petrol_batman: "energy_oil",
    energy_dogal_gaz_hamitabat_kirklareli: "energy_gas",
    energy_gunes_enerjisi_karapinar_konya: "energy_solar",
  };
  const question = makePlacementQuestion({
    id: "plus_energy_resource_placement",
    topic: "energy",
    title: "Enerji kaynakları",
    prompt: "Enerji kaynaklarını doğru harita noktalarına yerleştir.",
    helper: "Kaynak adını seçip haritadaki uygun enerji noktasına bırak.",
    targets,
    tokens,
    correctAssignments,
    answerSummary: "",
    kpssNote: "Enerji kaynaklarında taş kömürü, linyit, petrol, doğal gaz ve güneş alanları temel KPSS eşleştirmeleridir.",
  });

  return { ...question, answerSummary: placementSummary(question) };
}

function buildKpssTopicReviewPlacements(features: PlusFeature[]) {
  const questions: PlusQuestion[] = [];

  function pushPlacementQuestion({
    id,
    topic,
    title,
    prompt,
    helper,
    featureIds,
    colors,
    tokens,
    correctAssignments,
    kpssNote,
  }: {
    id: string;
    topic: Exclude<PlusQuestionTopic, "mixed">;
    title: string;
    prompt: string;
    helper: string;
    featureIds: string[];
    colors: string[];
    tokens: PlusToken[];
    correctAssignments: Record<string, string>;
    kpssNote: string;
  }) {
    const required = getFeatures(features, featureIds);

    if (!required) {
      return;
    }

    const question = makePlacementQuestion({
      id,
      topic,
      title,
      prompt,
      helper,
      targets: mapTargets(shuffle(required), targetLetters, colors),
      tokens: shuffle(tokens),
      correctAssignments,
      answerSummary: "",
      kpssNote,
    });

    questions.push({ ...question, answerSummary: placementSummary(question) });
  }

  pushPlacementQuestion({
    id: "plus_kpss_mine_review_placement",
    topic: "mine",
    title: "KPSS maden yorumu",
    prompt: "Madenleri KPSS'de ayırt ettiren klasik çıkarım alanlarıyla eşleştir.",
    helper: "Maden bilgisini seçip haritadaki doğru çıkarım merkezine yerleştir.",
    featureIds: ["mine_bor_kirka_eskisehir", "mine_bakir_murgul_artvin", "mine_demir_divrigi_sivas", "mine_krom_guleman_elazig"],
    colors: ["#7c3aed", "#b45309", "#6b7280", "#0f766e"],
    tokens: [
      token("mine_review_bor", "Bor", "Kırka / Eskişehir", "#7c3aed"),
      token("mine_review_bakir", "Bakır", "Murgul / Artvin", "#b45309"),
      token("mine_review_demir", "Demir", "Divriği / Sivas", "#6b7280"),
      token("mine_review_krom", "Krom", "Guleman / Elazığ", "#0f766e"),
    ],
    correctAssignments: {
      mine_bor_kirka_eskisehir: "mine_review_bor",
      mine_bakir_murgul_artvin: "mine_review_bakir",
      mine_demir_divrigi_sivas: "mine_review_demir",
      mine_krom_guleman_elazig: "mine_review_krom",
    },
    kpssNote: "Maden sorularında il-maden eşleşmeleri kadar maden kuşakları da önemlidir: bor Batı Anadolu'da, bakır Karadeniz ve Doğu Anadolu'da, demir Sivas-Malatya çevresinde öne çıkar.",
  });

  pushPlacementQuestion({
    id: "plus_kpss_industry_review_placement",
    topic: "industry",
    title: "KPSS sanayi yorumu",
    prompt: "Sanayi kollarını kuruluş yerini açıklayan merkezlerle eşleştir.",
    helper: "Sanayi kolunu seçip haritadaki doğru üretim merkezine yerleştir.",
    featureIds: [
      "industry_demir_celik_karabuk",
      "industry_otomotiv_bursa",
      "industry_seramik_sanayi_kutahya",
      "industry_petrol_rafinerisi_izmit_kocaeli",
      "industry_tekstil_denizli",
    ],
    colors: ["#64748b", "#2563eb", "#78716c", "#0891b2", "#db2777"],
    tokens: [
      token("industry_review_steel", "Demir-çelik", "Taş kömürü bağlantısı", "#64748b"),
      token("industry_review_auto", "Otomotiv", "Pazar ve ulaşım", "#2563eb"),
      token("industry_review_ceramic", "Seramik", "Yerel hammadde", "#78716c"),
      token("industry_review_refinery", "Rafineri", "Liman/pazar bağlantısı", "#0891b2"),
      token("industry_review_textile", "Tekstil", "Dokuma sanayi birikimi", "#db2777"),
    ],
    correctAssignments: {
      industry_demir_celik_karabuk: "industry_review_steel",
      industry_otomotiv_bursa: "industry_review_auto",
      industry_seramik_sanayi_kutahya: "industry_review_ceramic",
      industry_petrol_rafinerisi_izmit_kocaeli: "industry_review_refinery",
      industry_tekstil_denizli: "industry_review_textile",
    },
    kpssNote: "Sanayide kuruluş yeri hammadde, enerji, pazar, ulaşım ve sermaye ayrımıyla sorulur; aynı sanayi kolu farklı merkezlerde farklı nedenle gelişebilir.",
  });

  pushPlacementQuestion({
    id: "plus_kpss_energy_review_placement",
    topic: "energy",
    title: "KPSS enerji yorumu",
    prompt: "Enerji türlerini Türkiye'deki temsil alanlarıyla eşleştir.",
    helper: "Enerji türünü seçip haritadaki doğru potansiyel/üretim noktasına yerleştir.",
    featureIds: [
      "energy_taskomuru_zonguldak",
      "energy_jeotermal_enerji_kizildere_saraykoy_denizli",
      "energy_ruzgar_enerjisi_bozcaada_canakkale",
      "energy_gunes_enerjisi_karapinar_konya",
      "energy_ataturk_hes_bozova_sanliurfa",
    ],
    colors: ["#111827", "#ef4444", "#0ea5e9", "#facc15", "#2563eb"],
    tokens: [
      token("energy_review_coal", "Taş kömürü", "Zonguldak havzası", "#111827"),
      token("energy_review_geothermal", "Jeotermal", "Batı Anadolu grabeni", "#ef4444"),
      token("energy_review_wind", "Rüzgar", "Bozcaada / Çanakkale", "#0ea5e9"),
      token("energy_review_solar", "Güneş", "İç Anadolu güneşlenmesi", "#facc15"),
      token("energy_review_hydro", "Hidroelektrik", "Fırat üzerinde büyük baraj", "#2563eb"),
    ],
    correctAssignments: {
      energy_taskomuru_zonguldak: "energy_review_coal",
      energy_jeotermal_enerji_kizildere_saraykoy_denizli: "energy_review_geothermal",
      energy_ruzgar_enerjisi_bozcaada_canakkale: "energy_review_wind",
      energy_gunes_enerjisi_karapinar_konya: "energy_review_solar",
      energy_ataturk_hes_bozova_sanliurfa: "energy_review_hydro",
    },
    kpssNote: "Enerji sorularında kaynak türünü konumla birlikte düşünmek gerekir: jeotermal Batı Anadolu faylarıyla, HES akarsu rejimi ve eğimle, güneş iç-güney alanlarla ilişkilidir.",
  });

  pushPlacementQuestion({
    id: "plus_kpss_agriculture_review_placement",
    topic: "agriculture",
    title: "KPSS tarım yorumu",
    prompt: "Tarım ürünlerini onları sınırlayan iklim ve dağılış koşullarıyla eşleştir.",
    helper: "Ürünü seçip haritadaki doğru dağılış/iklim örneğine yerleştir.",
    featureIds: [
      "agriculture_cay_rize",
      "agriculture_findik_ordu",
      "agriculture_pamuk_harran_sanliurfa",
      "agriculture_bugday_konya",
      "agriculture_zeytin_aydin",
    ],
    colors: ["#16a34a", "#84cc16", "#db2777", "#ca8a04", "#65a30d"],
    tokens: [
      token("agriculture_review_tea", "Çay", "Her mevsim yağış", "#16a34a"),
      token("agriculture_review_hazelnut", "Fındık", "Nemli Karadeniz kıyısı", "#84cc16"),
      token("agriculture_review_cotton", "Pamuk", "Sulama ve sıcaklık", "#db2777"),
      token("agriculture_review_wheat", "Buğday", "Karasal tahıl alanı", "#ca8a04"),
      token("agriculture_review_olive", "Zeytin", "Akdeniz iklimi", "#65a30d"),
    ],
    correctAssignments: {
      agriculture_cay_rize: "agriculture_review_tea",
      agriculture_findik_ordu: "agriculture_review_hazelnut",
      agriculture_pamuk_harran_sanliurfa: "agriculture_review_cotton",
      agriculture_bugday_konya: "agriculture_review_wheat",
      agriculture_zeytin_aydin: "agriculture_review_olive",
    },
    kpssNote: "Tarım sorularında ürünün nerede yetiştiği kadar neden orada yoğunlaştığı da sorulur: yağış, sıcaklık, yaz kuraklığı ve sulama belirleyicidir.",
  });

  pushPlacementQuestion({
    id: "plus_kpss_livestock_review_placement",
    topic: "livestock",
    title: "KPSS hayvancılık yorumu",
    prompt: "Hayvancılık faaliyetlerini doğal ortam koşullarıyla eşleştir.",
    helper: "Faaliyeti seçip haritadaki doğru üretim alanına yerleştir.",
    featureIds: [
      "livestock_buyukbas_mera_kars",
      "livestock_koyun_konya",
      "livestock_aricilik_mugla",
      "livestock_tiftik_kecisi_ankara",
      "livestock_kultur_balikciligi_izmir",
    ],
    colors: ["#84cc16", "#a16207", "#8b5cf6", "#92400e", "#0ea5e9"],
    tokens: [
      token("livestock_review_cattle", "Büyükbaş mera", "Yaz yağışlı yüksek plato", "#84cc16"),
      token("livestock_review_sheep", "Koyun", "Bozkır otlakları", "#a16207"),
      token("livestock_review_bee", "Arıcılık", "Bitki çeşitliliği", "#8b5cf6"),
      token("livestock_review_mohair", "Tiftik keçisi", "Ankara çevresi", "#92400e"),
      token("livestock_review_fish", "Kültür balıkçılığı", "Ege kıyıları", "#0ea5e9"),
    ],
    correctAssignments: {
      livestock_buyukbas_mera_kars: "livestock_review_cattle",
      livestock_koyun_konya: "livestock_review_sheep",
      livestock_aricilik_mugla: "livestock_review_bee",
      livestock_tiftik_kecisi_ankara: "livestock_review_mohair",
      livestock_kultur_balikciligi_izmir: "livestock_review_fish",
    },
    kpssNote: "Hayvancılık dağılışında bitki örtüsü, yükselti, iklim ve pazar koşulları birlikte değerlendirilir; Doğu Anadolu büyükbaş, İç Anadolu küçükbaş örnekleriyle sık sorulur.",
  });

  pushPlacementQuestion({
    id: "plus_kpss_mountain_review_placement",
    topic: "mountain",
    title: "KPSS dağ yorumu",
    prompt: "Dağları oluşum/uzanış özellikleriyle eşleştir.",
    helper: "Dağ tipini veya konum bilgisini seçip doğru harita noktasına yerleştir.",
    featureIds: ["mountain_erciyes_dagi", "mountain_kackar_daglari", "mountain_aydin_daglari", "mountain_amanos_nur_daglari", "mountain_uludag"],
    colors: ["#dc2626", "#16a34a", "#7c3aed", "#0f766e", "#64748b"],
    tokens: [
      token("mountain_review_volcanic", "Volkanik dağ", "İç Anadolu örneği", "#dc2626"),
      token("mountain_review_blacksea", "Kuzey kıyı dağları", "Doğu Karadeniz", "#16a34a"),
      token("mountain_review_fault", "Kırık dağ", "Ege horst sistemi", "#7c3aed"),
      token("mountain_review_mediterranean", "Kıyıya paralel dağ", "Akdeniz doğusu", "#0f766e"),
      token("mountain_review_marmara", "Marmara yükseltisi", "Bursa çevresi", "#64748b"),
    ],
    correctAssignments: {
      mountain_erciyes_dagi: "mountain_review_volcanic",
      mountain_kackar_daglari: "mountain_review_blacksea",
      mountain_aydin_daglari: "mountain_review_fault",
      mountain_amanos_nur_daglari: "mountain_review_mediterranean",
      mountain_uludag: "mountain_review_marmara",
    },
    kpssNote: "Dağ sorularında yalnız ad değil, oluşum ve uzanış da önemlidir: Ege kırık dağları kıyıya dik, Karadeniz ve Akdeniz dağları kıyıya paralel uzanır.",
  });

  pushPlacementQuestion({
    id: "plus_kpss_river_review_placement",
    topic: "river",
    title: "KPSS akarsu yorumu",
    prompt: "Akarsuları döküldükleri deniz/havza özellikleriyle eşleştir.",
    helper: "Havza bilgisini seçip haritadaki doğru akarsu noktasına yerleştir.",
    featureIds: ["river_kizilirmak", "river_gediz_nehri", "river_firat_nehri", "river_aras_nehri", "river_asi_nehri"],
    colors: ["#0284c7", "#0ea5e9", "#2563eb", "#14b8a6", "#0891b2"],
    tokens: [
      token("river_review_blacksea", "Karadeniz'e dökülür", "Kızılırmak", "#0284c7"),
      token("river_review_aegean", "Ege'ye dökülür", "Gediz", "#0ea5e9"),
      token("river_review_persian", "Basra Körfezi havzası", "Fırat", "#2563eb"),
      token("river_review_caspian", "Hazar Denizi havzası", "Aras", "#14b8a6"),
      token("river_review_mediterranean", "Akdeniz'e dökülür", "Asi", "#0891b2"),
    ],
    correctAssignments: {
      river_kizilirmak: "river_review_blacksea",
      river_gediz_nehri: "river_review_aegean",
      river_firat_nehri: "river_review_persian",
      river_aras_nehri: "river_review_caspian",
      river_asi_nehri: "river_review_mediterranean",
    },
    kpssNote: "Akarsu sorularında akarsuyun Türkiye içindeki yönü kadar dış havza bağlantısı da sorulur; Fırat-Dicle Basra, Aras-Kura Hazar bağlantısıyla ayırt edilir.",
  });

  pushPlacementQuestion({
    id: "plus_kpss_lake_review_placement",
    topic: "lake",
    title: "KPSS göl yorumu",
    prompt: "Gölleri oluşum türleriyle eşleştir.",
    helper: "Oluşum türünü seçip haritadaki doğru göl noktasına yerleştir.",
    featureIds: ["lake_tuz_golu", "lake_salda_golu", "lake_van_golu", "lake_abant_golu", "lake_buyuk_cekmece"],
    colors: ["#2563eb", "#22c55e", "#f97316", "#a16207", "#06b6d4"],
    tokens: [
      token("lake_review_tectonic", "Tektonik göl", "İç Anadolu örneği", "#2563eb"),
      token("lake_review_karstic", "Karstik göl", "Göller Yöresi", "#22c55e"),
      token("lake_review_volcanic_dam", "Volkanik set gölü", "Doğu Anadolu", "#f97316"),
      token("lake_review_landslide", "Heyelan set gölü", "Batı Karadeniz", "#a16207"),
      token("lake_review_coastal", "Kıyı set gölü", "Marmara kıyısı", "#06b6d4"),
    ],
    correctAssignments: {
      lake_tuz_golu: "lake_review_tectonic",
      lake_salda_golu: "lake_review_karstic",
      lake_van_golu: "lake_review_volcanic_dam",
      lake_abant_golu: "lake_review_landslide",
      lake_buyuk_cekmece: "lake_review_coastal",
    },
    kpssNote: "Göl oluşumları KPSS'de sık karıştırılır; tektonik çöküntü, karstik çözünme, setlenme ve volkanizma ayrımı harita konumuyla birlikte öğrenilmelidir.",
  });

  pushPlacementQuestion({
    id: "plus_kpss_plain_plateau_review_placement",
    topic: "plainPlateau",
    title: "KPSS ova-plato yorumu",
    prompt: "Ova ve platoları oluşum/ekonomik kullanım özellikleriyle eşleştir.",
    helper: "Özelliği seçip haritadaki doğru ova veya plato noktasına yerleştir.",
    featureIds: [
      "plain_bafra_ovasi",
      "plain_konya_ovasi",
      "plain_harran_altinbasak_ovasi",
      "plateau_taseli_platosu",
      "plateau_erzurum_kars_platosu",
    ],
    colors: ["#0891b2", "#f97316", "#65a30d", "#22c55e", "#ef4444"],
    tokens: [
      token("plain_review_delta", "Delta ovası", "Kıyıda alüvyon birikimi", "#0891b2"),
      token("plain_review_inner", "İç ova", "Karasal tahıl alanı", "#f97316"),
      token("plain_review_gap", "GAP sulama alanı", "Harran çevresi", "#65a30d"),
      token("plain_review_karstic_plateau", "Karstik plato", "Akdeniz iç kesimi", "#22c55e"),
      token("plain_review_high_plateau", "Yüksek plato", "Büyükbaş mera", "#ef4444"),
    ],
    correctAssignments: {
      plain_bafra_ovasi: "plain_review_delta",
      plain_konya_ovasi: "plain_review_inner",
      plain_harran_altinbasak_ovasi: "plain_review_gap",
      plateau_taseli_platosu: "plain_review_karstic_plateau",
      plateau_erzurum_kars_platosu: "plain_review_high_plateau",
    },
    kpssNote: "Ovalar ve platolar konum, oluşum ve ekonomik faaliyet ilişkisiyle sorulur; delta ovaları kıyıda, karstik platolar kalkerli arazide, yüksek platolar mera hayvancılığında öne çıkar.",
  });

  pushPlacementQuestion({
    id: "plus_kpss_coast_review_placement",
    topic: "coast",
    title: "KPSS kıyı yorumu",
    prompt: "Kıyı tiplerini oluşum mantığı ve temsil alanlarıyla eşleştir.",
    helper: "Kıyı tipini seçip haritadaki doğru temsil noktasına yerleştir.",
    featureIds: [
      "coast_karadeniz_boyuna_kiyilari",
      "coast_ege_enine_kiyilari",
      "coast_istanbul_bogazi",
      "coast_kas_finike_arasi",
      "coast_mersin_silifke_arasi",
    ],
    colors: ["#f59e0b", "#0ea5e9", "#8b5cf6", "#ec4899", "#f97316"],
    tokens: [
      token("coast_review_boyuna", "Boyuna kıyı", "Dağlar kıyıya paralel", "#f59e0b"),
      token("coast_review_enine", "Enine kıyı", "Dağlar kıyıya dik", "#0ea5e9"),
      token("coast_review_ria", "Ria kıyı", "Eski vadi sular altında", "#8b5cf6"),
      token("coast_review_dalmatian", "Dalmaçya kıyı", "Paralel ada-kıyı dizilişi", "#ec4899"),
      token("coast_review_calankli", "Kalanklı kıyı", "Mersin-Silifke çevresi", "#f97316"),
    ],
    correctAssignments: {
      coast_karadeniz_boyuna_kiyilari: "coast_review_boyuna",
      coast_ege_enine_kiyilari: "coast_review_enine",
      coast_istanbul_bogazi: "coast_review_ria",
      coast_kas_finike_arasi: "coast_review_dalmatian",
      coast_mersin_silifke_arasi: "coast_review_calankli",
    },
    kpssNote: "Kıyı tiplerinde temel ipucu dağların kıyıya göre uzanışı ve kıyının sular altında kalma/setlenme biçimidir; Ege enine, Karadeniz-Akdeniz boyuna kıyı örneğidir.",
  });

  pushPlacementQuestion({
    id: "plus_kpss_tourism_review_placement",
    topic: "tourism",
    title: "KPSS turizm yorumu",
    prompt: "Turizm merkezlerini öne çıkan turizm türleriyle eşleştir.",
    helper: "Turizm türünü seçip haritadaki doğru merkeze yerleştir.",
    featureIds: [
      "tourism_kiyi_turizmi_antalya",
      "tourism_kultur_turizmi_ani_kars",
      "tourism_kis_turizmi_uludag_bursa",
      "tourism_termal_turizm_yalova",
      "tourism_kultur_turizmi_sumela_manastiri_macka_trabzon",
    ],
    colors: ["#06b6d4", "#9333ea", "#2563eb", "#ef4444", "#7c3aed"],
    tokens: [
      token("tourism_review_coastal", "Kıyı turizmi", "Antalya kıyıları", "#06b6d4"),
      token("tourism_review_culture", "Kültür turizmi", "Ani / Kars", "#9333ea"),
      token("tourism_review_winter", "Kış turizmi", "Uludağ / Bursa", "#2563eb"),
      token("tourism_review_thermal", "Termal turizm", "Yalova", "#ef4444"),
      token("tourism_review_religious", "İnanç-kültür turizmi", "Sümela / Trabzon", "#7c3aed"),
    ],
    correctAssignments: {
      tourism_kiyi_turizmi_antalya: "tourism_review_coastal",
      tourism_kultur_turizmi_ani_kars: "tourism_review_culture",
      tourism_kis_turizmi_uludag_bursa: "tourism_review_winter",
      tourism_termal_turizm_yalova: "tourism_review_thermal",
      tourism_kultur_turizmi_sumela_manastiri_macka_trabzon: "tourism_review_religious",
    },
    kpssNote: "Turizm sorularında merkez adı, bölge ve turizm türü birlikte sorulur; kıyı, kültür, kış, termal ve inanç turizmi ayrımı harita üzerinde pekiştirilmelidir.",
  });

  pushPlacementQuestion({
    id: "plus_kpss_port_review_placement",
    topic: "port",
    title: "KPSS liman yorumu",
    prompt: "Limanları hinterland ve ticaret bağlantılarıyla eşleştir.",
    helper: "Hinterland bilgisini seçip haritadaki doğru liman noktasına yerleştir.",
    featureIds: [
      "port_mersin_limani_mersin",
      "port_izmir_limani_izmir",
      "port_ambarli_limani_avcilar_istanbul",
      "port_samsun_limani_samsun",
      "port_trabzon_limani_trabzon",
    ],
    colors: ["#0284c7", "#0ea5e9", "#2563eb", "#14b8a6", "#0f766e"],
    tokens: [
      token("port_review_mersin", "Çukurova-GAP çıkışı", "Mersin", "#0284c7"),
      token("port_review_izmir", "Ege ihracat kapısı", "İzmir", "#0ea5e9"),
      token("port_review_ambarli", "Marmara dış ticareti", "Ambarlı", "#2563eb"),
      token("port_review_samsun", "Orta Karadeniz hinterlandı", "Samsun", "#14b8a6"),
      token("port_review_trabzon", "Doğu Karadeniz bağlantısı", "Trabzon", "#0f766e"),
    ],
    correctAssignments: {
      port_mersin_limani_mersin: "port_review_mersin",
      port_izmir_limani_izmir: "port_review_izmir",
      port_ambarli_limani_avcilar_istanbul: "port_review_ambarli",
      port_samsun_limani_samsun: "port_review_samsun",
      port_trabzon_limani_trabzon: "port_review_trabzon",
    },
    kpssNote: "Liman sorularında yalnız kıyı konumu değil, ard bölge ve ulaşım bağlantısı belirleyicidir; Mersin Çukurova-GAP, İzmir Ege, Samsun Orta Karadeniz bağlantısıyla öne çıkar.",
  });

  return questions;
}

const PROVINCE_OPTION_COUNT = 5;
const PROVINCE_TARGET_COLOR = "#34d399";

function provincePointDistanceSq(a: PlusPoint, b: PlusPoint) {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;

  return dLat * dLat + dLng * dLng;
}

function buildProvinceQuestions(provinces: ProvinceQuizInfo[]): PlusQuestion[] {
  if (provinces.length < PROVINCE_OPTION_COUNT) {
    return [];
  }

  const byName = new Map(provinces.map((province) => [province.name, province]));

  return provinces.map((province): PlusQuestion => {
    const neighborInfos = province.neighbors
      .map((name) => byName.get(name))
      .filter((info): info is ProvinceQuizInfo => Boolean(info));

    const distractors = shuffle(neighborInfos).slice(0, PROVINCE_OPTION_COUNT - 1);

    // Komşu sayısı yetmezse (kıyı illeri vb.) en yakın illerle tamamla.
    if (distractors.length < PROVINCE_OPTION_COUNT - 1) {
      const chosen = new Set([province.name, ...distractors.map((info) => info.name)]);
      const nearest = provinces
        .filter((candidate) => !chosen.has(candidate.name))
        .sort(
          (left, right) =>
            provincePointDistanceSq(left.point, province.point) -
            provincePointDistanceSq(right.point, province.point),
        )
        .slice(0, PROVINCE_OPTION_COUNT - 1 - distractors.length);

      distractors.push(...nearest);
    }

    const options = shuffle([province, ...distractors]);

    return makeChoiceQuestion({
      id: `plus_province_locate_${province.id}`,
      topic: "province",
      title: "Hangi il?",
      prompt: "Haritada işaretli nokta hangi ildedir?",
      helper: "İl sınırları gizli; komşu iller arasından doğru olanı seç.",
      targets: [
        {
          id: province.id,
          label: "?",
          point: province.point,
          name: province.name,
          detail: "Doğru il",
          color: PROVINCE_TARGET_COLOR,
          markerIconName: "",
        },
      ],
      tokens: options.map((option) => token(option.id, option.name, "", PROVINCE_TARGET_COLOR)),
      correctTokenId: province.id,
      answerSummary: `İşaretli nokta ${province.name} ilindedir.`,
      kpssNote: `İşaretli nokta ${province.name} ilinin sınırları içindedir.`,
      revealProvinceName: province.name,
    });
  });
}

type PlusQuestionBuilderResult = PlusQuestion | PlusQuestion[] | null;

const builders: Array<(features: PlusFeature[]) => PlusQuestionBuilderResult> = [
  buildMapLocateQuestions,
  buildMapMatchQuestions,
  buildPointIdentifyQuestions,
  buildCategoryOddOneOutQuestions,
  buildRepeatedNameDistributionQuestions,
  buildMinePlacement,
  buildMineReverse,
  buildSpecialMinePlacement,
  buildIndustryReason,
  buildFactoryPlacement,
  buildRawMaterialIndustryPlacement,
  buildLivestockSpecializationPlacement,
  buildMicroclimatePlacement,
  buildCoreCropPlacement,
  buildWetCropPick,
  buildOilPlantPlacement,
  buildVolcanicMountainPick,
  buildNorthAnatolianMountainPick,
  buildFaultMountainPlacement,
  buildCoastTypePlacement,
  buildRiverBasinPlacement,
  buildDamRiverPlacement,
  buildKarsticLakePick,
  buildCoastalSetLakePick,
  buildLakeNamePlacement,
  buildLakeFormationPlacement,
  buildDeltaPlainPick,
  buildAegeanGrabenPlainPick,
  buildPlateauEconomyPlacement,
  buildInnerPlateauPick,
  buildTourismAttractionPlacement,
  buildPortHinterlandPlacement,
  buildRenewableEnergyPlacement,
  buildEnergyResourcePlacement,
  buildKpssTopicReviewPlacements,
];

function buildCandidates(
  features: PlusFeature[],
  topics: Array<Exclude<PlusQuestionTopic, "mixed">>,
  mode: PlusQuestionMode,
  questionIds?: string[],
  provinces: ProvinceQuizInfo[] = [],
) {
  const allowedQuestionIds = questionIds ? new Set(questionIds) : null;

  return [
    ...builders.flatMap((builder) => {
      const result = builder(features);

      return Array.isArray(result) ? result : [result];
    }),
    ...buildProvinceQuestions(provinces),
  ]
    .filter((question): question is PlusQuestion => Boolean(question))
    .filter((question) => !allowedQuestionIds || allowedQuestionIds.has(question.id))
    .filter((question) => topics.length === 0 || topics.includes(question.topic))
    .filter((question) => mode === "mixed" || question.kind === mode);
}

const mixedQuestionKindWeights: Record<PlusQuestionKind, number> = {
  mapLocate: 2,
  mapMatch: 3,
  placement: 4,
  pickOne: 4,
  pickMany: 4,
  choice: 4,
};

function selectPlusQuestion(
  candidates: PlusQuestion[],
  mode: PlusQuestionMode,
  recentTopics: Set<string>,
) {
  if (candidates.length === 0) {
    return undefined;
  }

  // Spread by topic so the same topic does not dominate consecutive mixed rounds.
  const freshTopicCandidates = candidates.filter((question) => !recentTopics.has(question.topic));
  const pool = freshTopicCandidates.length > 0 ? freshTopicCandidates : candidates;

  if (mode !== "mixed") {
    return shuffle(pool)[0];
  }

  const weightedCandidates = pool.flatMap((question) =>
    Array.from({ length: mixedQuestionKindWeights[question.kind] }, () => question),
  );

  return shuffle(weightedCandidates)[0] ?? shuffle(pool)[0];
}

export function getPlusAvailability(
  features: PlusFeature[],
  topics: Array<Exclude<PlusQuestionTopic, "mixed">>,
  mode: PlusQuestionMode,
  questionIds?: string[],
  provinces: ProvinceQuizInfo[] = [],
): PlusAvailability {
  const candidates = buildCandidates(features, [], mode, questionIds, provinces);
  const byTopic = {
    mine: 0,
    industry: 0,
    energy: 0,
    agriculture: 0,
    livestock: 0,
    mountain: 0,
    river: 0,
    lake: 0,
    plainPlateau: 0,
    coast: 0,
    tourism: 0,
    port: 0,
    province: 0,
  };

  for (const question of candidates) {
    byTopic[question.topic] += 1;
  }

  return {
    total: topics.length === 0 ? candidates.length : topics.reduce((sum, topic) => sum + byTopic[topic], 0),
    byTopic,
  };
}

const singleFeatureQuestionKinds = new Set<PlusQuestionKind>(["mapLocate", "mapMatch", "choice"]);
const singleFeatureSeedPrefixes = ["plus_map_locate_", "plus_map_match_", "plus_point_identify_"];

function featureRepeatKey(featureId: string) {
  return `feature:${featureId}`;
}

function questionRepeatKey(question: PlusQuestion) {
  if (singleFeatureQuestionKinds.has(question.kind) && question.correctTargetIds.length === 1) {
    const targetId = question.correctTargetIds[0];

    if (question.kind === "mapLocate" || question.correctTokenId === targetId) {
      return featureRepeatKey(targetId);
    }
  }

  return `question:${question.id}`;
}

function seedRepeatKey(seedId: string) {
  const featurePrefix = singleFeatureSeedPrefixes.find((prefix) => seedId.startsWith(prefix));

  return featurePrefix ? featureRepeatKey(seedId.slice(featurePrefix.length)) : `question:${seedId}`;
}

function pickAvoidingRecent(candidates: PlusQuestion[], recentSeedIds: string[]) {
  if (candidates.length <= 1 || recentSeedIds.length === 0) {
    return candidates;
  }

  const recentRepeatKeys = new Set(recentSeedIds.map(seedRepeatKey));
  const repeatAvoided = candidates.filter((question) => !recentRepeatKeys.has(questionRepeatKey(question)));

  if (repeatAvoided.length > 0) {
    return repeatAvoided;
  }

  const fullyAvoided = candidates.filter((question) => !recentSeedIds.includes(question.id));

  if (fullyAvoided.length > 0) {
    return fullyAvoided;
  }

  const mostRecentSeedId = recentSeedIds[0];
  const avoidedLastOnly = candidates.filter((question) => question.id !== mostRecentSeedId);

  return avoidedLastOnly.length > 0 ? avoidedLastOnly : candidates;
}

export function generatePlusQuestion({
  features,
  topics,
  mode,
  recentQuestionIds,
  questionIds,
  provinces,
}: {
  features: PlusFeature[];
  topics: Array<Exclude<PlusQuestionTopic, "mixed">>;
  mode: PlusQuestionMode;
  recentQuestionIds: string[];
  questionIds?: string[];
  provinces?: ProvinceQuizInfo[];
}) {
  const candidates = buildCandidates(features, topics, mode, questionIds, provinces ?? []);
  const recentSeedIds = recentQuestionIds.map((id) => id.split("__")[0]);
  const seedTopicById = new Map(candidates.map((question) => [question.id, question.topic]));
  const recentTopics = new Set(
    recentSeedIds
      .slice(0, 2)
      .map((seedId) => seedTopicById.get(seedId))
      .filter((value): value is Exclude<PlusQuestionTopic, "mixed"> => Boolean(value)),
  );
  const nextCandidates = pickAvoidingRecent(candidates, recentSeedIds);
  const selected = selectPlusQuestion(nextCandidates, mode, recentTopics);

  if (!selected) {
    return null;
  }

  return {
    ...selected,
    id: `${selected.id}__${Date.now()}_${Math.round(Math.random() * 100000)}`,
  };
}

export function getPlusPlacementCorrectness(question: PlusQuestion, assignments: Record<string, string>) {
  return question.targets.map((target) => ({
    targetId: target.id,
    isCorrect: assignments[target.id] === question.correctAssignments[target.id],
  }));
}

export function getPlusTargetCorrectness(question: PlusQuestion, selectedTargetIds: string[]) {
  const correctIds = new Set(question.correctTargetIds);
  const selectedIds = new Set(selectedTargetIds);
  const wrongTargetIds = selectedTargetIds.filter((targetId) => !correctIds.has(targetId));
  const missedTargetIds = question.correctTargetIds.filter((targetId) => !selectedIds.has(targetId));

  return {
    isCorrect: wrongTargetIds.length === 0 && missedTargetIds.length === 0,
    wrongTargetIds,
    missedTargetIds,
  };
}

export function isPlusFeature(feature: PlusFeature) {
  return isPhysicalFeature(feature) || isEconomicFeature(feature);
}
