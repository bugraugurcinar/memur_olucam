import {
  getEconomicFeatureDisplayName,
  getEconomicLocationShortLabel,
  isEconomicFeature,
  type EconomicFeature,
} from "../geojson/economicFeatures";
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
  | "mountain"
  | "river"
  | "lake"
  | "plainPlateau";

export type PlusPoint = {
  lat: number;
  lng: number;
};

export type PlusMapTarget = {
  id: string;
  label: string;
  point: PlusPoint;
  name: string;
  detail: string;
  color: string;
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
  { id: "mountain", label: "Dağlar" },
  { id: "river", label: "Akarsular" },
  { id: "lake", label: "Göller" },
  { id: "plainPlateau", label: "Ova / Plato" },
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
  }));
}

function uniquePointFeatures(features: PlusFeature[]) {
  return uniqueBy(
    features.filter((feature) => featurePoint(feature)),
    (feature) => featureDisplayName(feature),
  );
}

function uniqueDisplayNameCandidates(features: PlusFeature[]) {
  const displayNameCounts = features.reduce<Record<string, number>>((counts, feature) => {
    const displayName = featureDisplayName(feature);

    counts[displayName] = (counts[displayName] ?? 0) + 1;
    return counts;
  }, {});

  return features.filter(
    (feature) => Boolean(featurePoint(feature)) && displayNameCounts[featureDisplayName(feature)] === 1,
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
    topic === "mountain" ||
    topic === "river" ||
    topic === "lake"
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

  if (topic === "industry" || topic === "energy") {
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

type PlusQuestionBuilderResult = PlusQuestion | PlusQuestion[] | null;

const builders: Array<(features: PlusFeature[]) => PlusQuestionBuilderResult> = [
  buildMapLocateQuestions,
  buildMapMatchQuestions,
  buildCategoryOddOneOutQuestions,
  buildRepeatedNameDistributionQuestions,
  buildMinePlacement,
  buildMineReverse,
  buildSpecialMinePlacement,
  buildIndustryReason,
  buildFactoryPlacement,
  buildRawMaterialIndustryPlacement,
  buildMicroclimatePlacement,
  buildCoreCropPlacement,
  buildWetCropPick,
  buildVolcanicMountainPick,
  buildFaultMountainPlacement,
  buildDamRiverPlacement,
  buildKarsticLakePick,
  buildLakeNamePlacement,
  buildLakeFormationPlacement,
  buildDeltaPlainPick,
  buildPlateauEconomyPlacement,
  buildInnerPlateauPick,
  buildEnergyResourcePlacement,
];

function buildCandidates(features: PlusFeature[], topic: PlusQuestionTopic, mode: PlusQuestionMode) {
  return builders
    .flatMap((builder) => {
      const result = builder(features);

      return Array.isArray(result) ? result : [result];
    })
    .filter((question): question is PlusQuestion => Boolean(question))
    .filter((question) => topic === "mixed" || question.topic === topic)
    .filter((question) => mode === "mixed" || question.kind === mode);
}

const mixedQuestionKindWeights: Record<PlusQuestionKind, number> = {
  mapLocate: 1,
  mapMatch: 2,
  placement: 6,
  pickOne: 5,
  pickMany: 5,
  choice: 4,
};

function selectPlusQuestion(candidates: PlusQuestion[], mode: PlusQuestionMode) {
  if (mode !== "mixed") {
    return shuffle(candidates)[0];
  }

  const candidatesByKind = candidates.reduce<Partial<Record<PlusQuestionKind, PlusQuestion[]>>>((groups, question) => {
    groups[question.kind] = [...(groups[question.kind] ?? []), question];
    return groups;
  }, {});
  const weightedKinds = Object.entries(mixedQuestionKindWeights).flatMap(([kind, weight]) =>
    candidatesByKind[kind as PlusQuestionKind] ? Array.from({ length: weight }, () => kind as PlusQuestionKind) : [],
  );
  const selectedKind = shuffle(weightedKinds)[0];

  return selectedKind ? shuffle(candidatesByKind[selectedKind] ?? [])[0] : shuffle(candidates)[0];
}

export function getPlusAvailability(
  features: PlusFeature[],
  topic: PlusQuestionTopic,
  mode: PlusQuestionMode,
): PlusAvailability {
  const candidates = buildCandidates(features, "mixed", mode);
  const byTopic = {
    mine: 0,
    industry: 0,
    energy: 0,
    agriculture: 0,
    mountain: 0,
    river: 0,
    lake: 0,
    plainPlateau: 0,
  };

  for (const question of candidates) {
    byTopic[question.topic] += 1;
  }

  return {
    total: topic === "mixed" ? candidates.length : byTopic[topic],
    byTopic,
  };
}

export function generatePlusQuestion({
  features,
  topic,
  mode,
  previousQuestionId,
}: {
  features: PlusFeature[];
  topic: PlusQuestionTopic;
  mode: PlusQuestionMode;
  previousQuestionId: string | null;
}) {
  const candidates = buildCandidates(features, topic, mode);
  const previousSeedId = previousQuestionId?.split("__")[0] ?? null;
  const nextCandidates =
    candidates.length > 1 ? candidates.filter((question) => question.id !== previousSeedId) : candidates;
  const selected = selectPlusQuestion(nextCandidates, mode);

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
