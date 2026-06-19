import type { EconomicFeature } from "../geojson/economicFeatures";
import {
  economicFeatureCategories,
  getEconomicFeatureDisplayName,
  getEconomicLocationShortLabel,
  isEconomicFeature,
} from "../geojson/economicFeatures";
import type { PhysicalFeature } from "../geojson/physicalFeatures";
import { physicalFeatureCategories } from "../geojson/physicalFeatures";

export type QuizFeature = PhysicalFeature | EconomicFeature;

export type QuizPoint = {
  lat: number;
  lng: number;
};

export type QuestionKind =
  | "mapLocate"
  | "reverseMapIdentify"
  | "categoryChoice"
  | "locationMatch"
  | "featureFromLocation"
  | "notInCategory"
  | "trueFalse"
  | "iIiI"
  | "bestExplanation"
  | "nearbyConcept"
  | "similarDisambiguation";

export type QuizMode =
  | "mixed"
  | "mapLocate"
  | "reverseMapIdentify"
  | "category"
  | "matching"
  | "kpss"
  | "review";

export type QuizDifficulty = "easy" | "medium" | "hard";
export type QuizRoundMode = "free" | "timed";

export type QuizChoice = {
  id: string;
  label: string;
  detail?: string;
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

export const QUIZ_CORRECT_RADIUS_KM = 75;
export const TIMED_ROUND_SECONDS = 60;
export const TIMED_ROUND_TARGET = 10;

export const quizModeOptions: Array<{ id: QuizMode; label: string }> = [
  { id: "mixed", label: "Karma Öğrenme" },
  { id: "mapLocate", label: "Haritada Bul" },
  { id: "reverseMapIdentify", label: "Ters Harita" },
  { id: "category", label: "Kategori" },
  { id: "matching", label: "Eşleştirme" },
  { id: "kpss", label: "KPSS Karma" },
  { id: "review", label: "Tekrar" },
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

const allCategories = [...physicalFeatureCategories, ...economicFeatureCategories];

const bestExplanationTemplates: Record<string, { correct: string; wrong: string[] }> = {
  agriculture_cereal_legume: {
    correct: "Karasal iklim, sulama ve ova koşulları ürün dağılışını belirler.",
    wrong: [
      "Yalnızca kıyı turizmi bu dağılışı belirler.",
      "Volkanizma ürünü olduğu için bu alanda toplanır.",
      "Sadece taşkömürü havzasına bağlı gelişir.",
    ],
  },
  agriculture_industrial: {
    correct: "Sanayi bitkileri hammadde bağlantısı ve işleme tesisleriyle birlikte düşünülür.",
    wrong: [
      "Oluşum tipine göre set gölü olarak sınıflanır.",
      "Yalnızca dağların uzanış yönüyle açıklanır.",
      "Sadece doğal liman koşullarıyla ortaya çıkar.",
    ],
  },
  agriculture_climate_selective: {
    correct: "Sıcaklık, yağış ve don riski gibi iklim koşulları belirleyicidir.",
    wrong: [
      "Yer şeklinin kıvrım dağ olması tek belirleyicidir.",
      "Taşkömürü yataklarına yakınlık temel nedendir.",
      "Akarsuyun Basra Körfezi'ne dökülmesi gerekir.",
    ],
  },
  agriculture_special_crop: {
    correct: "Belirli iklim ve toprak istekleri nedeniyle il-ürün eşleştirmesi önemlidir.",
    wrong: [
      "Sadece ağır sanayi tesislerinin dağılışıyla açıklanır.",
      "Her zaman kıyı set gölü çevresinde yetişir.",
      "Dağların volkanik olması zorunludur.",
    ],
  },
  livestock_pasture: {
    correct: "Geniş çayır ve mera alanları hayvancılık türünü belirler.",
    wrong: [
      "Delta ovası oluşumu bu faaliyetin temel şartıdır.",
      "Petrokimya tesislerine yakınlık birincil etkendir.",
      "Sadece pirinç tarımı yapılan yerlerde gelişir.",
    ],
  },
  livestock_stall: {
    correct: "Pazar, yem ve sanayi bağlantısı besi/ahır hayvancılığını destekler.",
    wrong: [
      "Yalnızca yüksek dağ buzullarıyla ilgilidir.",
      "Kıyı tipi bu faaliyetin tek belirleyicisidir.",
      "Sadece bor yataklarının olduğu yerlerde gelişir.",
    ],
  },
  livestock_small_ruminant: {
    correct: "Bozkır ve maki gibi bitki örtüleri küçükbaş hayvancılığı destekler.",
    wrong: [
      "Taşkömürü çıkarımı küçükbaş dağılışını belirler.",
      "Sadece çay tarımı yapılan kıyılarda görülür.",
      "Delta oluşumu zorunlu koşuldur.",
    ],
  },
  livestock_specialized: {
    correct: "Yerel bitki örtüsü, iklim ve geleneksel üretim koşulları belirleyicidir.",
    wrong: [
      "Sadece rafineri bulunan illerde yapılır.",
      "Volkanik set gölü olması gerekir.",
      "Her zaman Ege enine kıyılarında görülür.",
    ],
  },
  livestock_poultry_fishery: {
    correct: "Pazar, yem, kıyı koşulları ve su ürünleri potansiyeli önemlidir.",
    wrong: [
      "Karstik ova oluşumu tek belirleyicidir.",
      "Yalnızca demir-çelik merkezlerinde gelişir.",
      "Akarsuyun kapalı havzada olması gerekir.",
    ],
  },
  mine_metal: {
    correct: "Metal madenleri çıkarım alanı ve işleme merkezi eşleştirmesiyle öğrenilir.",
    wrong: [
      "Tarımda don riskiyle doğrudan sınıflandırılır.",
      "Kıyı tipi olduğu için bu gruba girer.",
      "Delta ovası oluşumu temel ölçüttür.",
    ],
  },
  mine_industrial: {
    correct: "Endüstriyel madenler sanayide hammadde olarak kullanılan yataklarla ilişkilidir.",
    wrong: [
      "Sadece balıkçılık merkezlerinde görülür.",
      "Akarsuyun döküldüğü denize göre adlandırılır.",
      "Mera hayvancılığı sınıfına girer.",
    ],
  },
  energy_fossil: {
    correct: "Fosil enerji kaynaklarında havza, çıkarım alanı ve santral/rafineri bağlantısı önemlidir.",
    wrong: [
      "Kıyı tipi oluşumunu açıklayan bir sınıflamadır.",
      "Sadece karstik göller çevresinde bulunur.",
      "Bir tarım ürünü iklim seçiciliği örneğidir.",
    ],
  },
  energy_hydroelectric: {
    correct: "Hidroelektrik potansiyel akarsu debisi, eğim ve baraj kurulabilecek vadilerle ilişkilidir.",
    wrong: [
      "Sadece pamuk üretim alanlarına bağlı gelişir.",
      "Kıyı turizmi için yaz kuraklığını açıklayan bir örnektir.",
      "Tersiyer linyit havzalarının dağılışıyla sınıflanır.",
    ],
  },
  energy_geothermal: {
    correct: "Jeotermal enerji fay hatları ve sıcak su kaynaklarının yoğun olduğu alanlarla ilişkilidir.",
    wrong: [
      "Dağların kıyıya dik uzanmasıyla oluşan kıyı tipidir.",
      "Sadece liman hinterlandı geniş olan kentlerde görülür.",
      "Alüvyal set gölü oluşumunun doğrudan sonucudur.",
    ],
  },
  energy_wind: {
    correct: "Rüzgar enerjisi sürekli ve güçlü rüzgar alan kıyı, boğaz ve geçit çevrelerinde öne çıkar.",
    wrong: [
      "Karstik çözünme sonucu oluşan ova örneğidir.",
      "Yalnızca taşkömürü çıkarımına bağlıdır.",
      "İpekböcekçiliğiyle aynı üretim koşullarını ister.",
    ],
  },
  energy_solar: {
    correct: "Güneş enerjisi güneşlenme süresi ve açık gün sayısı yüksek iç ve güney kesimlerle ilişkilidir.",
    wrong: [
      "Yağışın yıl boyu çok olduğu kıyılarda zorunlu olarak yoğunlaşır.",
      "Kıvrım dağlarının oluşum nedenini açıklar.",
      "Sadece doğal limanların bulunduğu noktalarda gelişir.",
    ],
  },
  industry_processing: {
    correct: "Hammadde, ulaşım, liman ve pazar bağlantıları sanayi merkezlerini belirler.",
    wrong: [
      "Oluşumuna göre tektonik göl olarak sınıflanır.",
      "Yalnızca küçükbaş hayvancılıkla açıklanır.",
      "Dağların kıvrım olması zorunludur.",
    ],
  },
  industry_refinery_petrochemical: {
    correct: "Ham petrol, liman, boru hattı ve pazar bağlantısı bu tesislerde öne çıkar.",
    wrong: [
      "Kıyı set gölü oluşumuyla ilgilidir.",
      "Çay tarımı için yıkanmış toprak şartıyla açıklanır.",
      "Büyükbaş mera hayvancılığı sınıfıdır.",
    ],
  },
  industry_automotive_machinery: {
    correct: "Pazar, ulaşım, yan sanayi ve nitelikli iş gücü bu sanayi kolunu güçlendirir.",
    wrong: [
      "Sadece taşkömürü çıkarılan dar havzalarda yapılır.",
      "Karstik plato oluşumuna bağlıdır.",
      "Akarsu ağzında alüvyon birikmesi gerekir.",
    ],
  },
  industry_textile: {
    correct: "Pazar, iş gücü, pamuk ve ulaşım bağlantıları tekstil merkezlerini etkiler.",
    wrong: [
      "Volkanik dağ oluşumu bu sanayi kolunu belirler.",
      "Sadece lületaşı çıkarılan yerde yapılır.",
      "Akarsuyun Hazar'a dökülmesi gerekir.",
    ],
  },
  industry_food_agro: {
    correct: "Tarımsal sanayi ürüne yakınlık, bozulabilirlik ve hammadde sürekliliğiyle ilişkilidir.",
    wrong: [
      "Sadece volkanik set gölleri çevresinde kurulur.",
      "Akarsuyun döküldüğü denize göre sınıflanır.",
      "Ria kıyı tipinin doğrudan sonucudur.",
    ],
  },
  industry_material: {
    correct: "Kağıt, seramik ve cam sanayisinde hammadde, su, enerji, pazar ve ulaşım bağlantıları önemlidir.",
    wrong: [
      "Sadece çay tarımının görüldüğü yıkanmış topraklara bağlıdır.",
      "Küçükbaş hayvancılığın alt türüdür.",
      "Delta ovası oluşumunu açıklayan fiziki süreçtir.",
    ],
  },
  tourism_coastal: {
    correct: "Kıyı turizmi deniz, güneşlenme süresi, yaz kuraklığı ve ulaşım olanaklarıyla ilişkilidir.",
    wrong: [
      "Sadece metal madenlerinin çıkarım alanlarıyla açıklanır.",
      "Faylanmayla oluşan tektonik ova grubudur.",
      "Akarsu rejimini belirleyen bir havza türüdür.",
    ],
  },
  tourism_cultural: {
    correct: "Kültür turizmi tarihsel miras, doğal-kültürel peyzaj ve ulaşılabilir merkezlerle ilişkilidir.",
    wrong: [
      "Yalnızca yaz kuraklığı isteyen sanayi bitkisidir.",
      "Volkanik lav platosu sınıfına girer.",
      "Demir-çelik sanayisinin hammadde basamağıdır.",
    ],
  },
  tourism_winter_thermal: {
    correct: "Kış ve termal turizm yükselti, kar örtüsü, fay hatları ve sıcak su kaynaklarıyla ilişkilidir.",
    wrong: [
      "Kıyı set gölü oluşumuyla aynı sınıftadır.",
      "Sadece pamuklu dokuma merkezlerinde gelişir.",
      "Akarsuların Basra Körfezi'ne dökülmesini açıklar.",
    ],
  },
  port_trade: {
    correct: "Büyük dış ticaret limanlarında hinterland, sanayi, ulaşım ve dış ticaret bağlantısı belirleyicidir.",
    wrong: [
      "Sadece karstik plato yüzeylerinde görülür.",
      "Çay ve fındık gibi iklim seçici ürünlerin alt türüdür.",
      "Dağların volkanik oluşumunu açıklar.",
    ],
  },
  port_regional: {
    correct: "Bölgesel limanlar bulundukları kıyı kuşağının ulaşım, ticaret ve hinterland bağlantısını temsil eder.",
    wrong: [
      "Mera hayvancılığının doğrudan sınıflandırmasıdır.",
      "Krom ve boksit çıkarımı için kullanılan maden terimidir.",
      "Tektonik göllerin oluşum sürecidir.",
    ],
  },
  mountain_fault_block: {
    correct: "Kırık dağlar faylanma ve blok hareketleriyle ilişkilidir.",
    wrong: [
      "Lav akıntılarının oluşturduğu plato örneğidir.",
      "Akarsuyun döküldüğü denize göre adlandırılır.",
      "Rafineri-petrokimya sanayisine girer.",
    ],
  },
  mountain_fold: {
    correct: "Kıvrım dağları sıkışma ve kıvrılma hareketleriyle oluşur.",
    wrong: [
      "Kıyı set gölü oluşumudur.",
      "Sanayi bitkisi olarak sınıflanır.",
      "Fosil enerji kaynağıdır.",
    ],
  },
  mountain_volcanic: {
    correct: "Volkanik dağlar iç kuvvetler ve püskürme faaliyetleriyle ilişkilidir.",
    wrong: [
      "Delta ovası birikimiyle oluşur.",
      "Tekstil sanayi merkezidir.",
      "Karadeniz'e dökülen akarsu sınıfıdır.",
    ],
  },
  plain_delta: {
    correct: "Delta ovaları akarsuların taşıdığı alüvyonları kıyıda biriktirmesiyle oluşur.",
    wrong: [
      "Yalnızca volkanizma sonucu ortaya çıkar.",
      "Petrol rafinerisi sınıfına girer.",
      "Küçükbaş hayvancılık faaliyetidir.",
    ],
  },
  plain_karstic: {
    correct: "Karstik ovalar kalkerli arazilerde çözünme süreçleriyle ilişkilidir.",
    wrong: [
      "Deniz ticaretiyle gelişen sanayi merkezidir.",
      "Sadece taşkömürü havzasında oluşur.",
      "Akarsu döküldüğü denize göre sınıflanır.",
    ],
  },
  plain_tectonic: {
    correct: "Tektonik ovalar faylanma ve çökme alanlarıyla ilişkilidir.",
    wrong: [
      "Meyve ve özel ürün tarımı sınıfıdır.",
      "Kıyı tipi eşleştirmesidir.",
      "Sadece kültür balıkçılığı alanıdır.",
    ],
  },
};

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

function featureLocationLabel(feature: QuizFeature, shouldAllowProvinceOnly = true) {
  return isEconomicFeature(feature)
    ? getEconomicLocationShortLabel(feature.properties.location, shouldAllowProvinceOnly)
    : feature.properties.location;
}

function choiceFromFeature(feature: QuizFeature): QuizChoice {
  return {
    id: feature.properties.id,
    label: featureDisplayName(feature),
    detail: feature.properties.categoryLabel,
  };
}

function categoryOptionsForTopic(topic: string) {
  return allCategories.filter((category) => category.topic === topic);
}

function getCategoryLabel(categoryId: string) {
  return allCategories.find((category) => category.id === categoryId)?.label ?? categoryId;
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

function makeChoices(correct: QuizChoice, distractors: QuizChoice[]) {
  const choices = shuffle(uniqueBy([correct, ...distractors], (choice) => choice.label)).slice(0, 4);

  if (!choices.some((choice) => choice.id === correct.id)) {
    choices[Math.max(0, choices.length - 1)] = correct;
  }

  return shuffle(choices);
}

function getDistractorFeatures(
  target: QuizFeature,
  pool: QuizFeature[],
  options: { sameTopic?: boolean; sameCategory?: boolean; excludeSameName?: boolean } = {},
) {
  return pool.filter((feature) => {
    if (feature.properties.id === target.properties.id) {
      return false;
    }

    if (options.sameTopic && feature.properties.topic !== target.properties.topic) {
      return false;
    }

    if (options.sameCategory && feature.properties.category !== target.properties.category) {
      return false;
    }

    if (options.excludeSameName && feature.properties.name === target.properties.name) {
      return false;
    }

    return true;
  });
}

function buildMapLocate(target: QuizFeature, difficulty: QuizDifficulty) {
  return makeQuestion("mapLocate", target, {
    prompt: `${featureDisplayName(target)} nerede?`,
    helper: "Haritada tahmin noktanı seç.",
    answerSummary: `${featureDisplayName(target)} doğru konum olarak gösterildi.`,
    expectedLabel: featureDisplayName(target),
    choices: [],
    correctChoiceIds: [],
    requiresMapAnswer: true,
    showTargetOnMap: false,
    allowsSecondAttempt: difficulty !== "hard",
  });
}

function buildReverseMapIdentify(target: QuizFeature, pool: QuizFeature[]) {
  const distractors = getDistractorFeatures(target, pool, { sameTopic: true })
    .map(choiceFromFeature)
    .filter((choice) => choice.label !== featureDisplayName(target));
  const correct = choiceFromFeature(target);
  const choices = makeChoices(correct, distractors);

  if (choices.length < 4) {
    return null;
  }

  return makeQuestion("reverseMapIdentify", target, {
    prompt: "Haritada işaretlenen nokta hangisi?",
    helper: "Noktayı incele ve doğru unsuru seç.",
    answerSummary: `Doğru cevap: ${featureDisplayName(target)}.`,
    expectedLabel: featureDisplayName(target),
    choices,
    correctChoiceIds: [correct.id],
    requiresMapAnswer: false,
    showTargetOnMap: true,
    allowsSecondAttempt: false,
  });
}

function buildCategoryChoice(target: QuizFeature) {
  const categories = categoryOptionsForTopic(target.properties.topic);

  if (categories.length < 2) {
    return null;
  }

  const correct = {
    id: target.properties.category,
    label: target.properties.categoryLabel,
    detail: target.properties.topicLabel,
  };
  const choices = makeChoices(
    correct,
    categories
      .filter((category) => category.id !== target.properties.category)
      .map((category) => ({ id: category.id, label: category.label, detail: target.properties.topicLabel })),
  );

  if (choices.length < 2) {
    return null;
  }

  return makeQuestion("categoryChoice", target, {
    prompt: `${featureDisplayName(target)} hangi kategoriye girer?`,
    helper: "Alt kategori bilgisini seç.",
    answerSummary: `${featureDisplayName(target)}: ${target.properties.categoryLabel}.`,
    expectedLabel: target.properties.categoryLabel,
    choices,
    correctChoiceIds: [correct.id],
    requiresMapAnswer: false,
    showTargetOnMap: false,
    allowsSecondAttempt: false,
  });
}

function buildLocationMatch(target: QuizFeature, pool: QuizFeature[]) {
  const targetLocationLabel = featureLocationLabel(target);
  const correct = {
    id: target.properties.id,
    label: targetLocationLabel,
    detail: target.properties.name,
  };
  const distractors = getDistractorFeatures(target, pool, { sameTopic: true })
    .filter((feature) => featureLocationLabel(feature) !== targetLocationLabel)
    .map((feature) => ({
      id: feature.properties.id,
      label: featureLocationLabel(feature),
      detail: feature.properties.name,
    }))
    .filter((choice) => choice.label);
  const choices = makeChoices(correct, distractors);

  if (choices.length < 4) {
    return null;
  }

  return makeQuestion("locationMatch", target, {
    prompt: `${target.properties.name} için bu çalışmada verilen merkez hangisi?`,
    helper: "Ürün, maden, sanayi veya yer şekli ile merkezi eşleştir.",
    answerSummary: `${target.properties.name} - ${targetLocationLabel}.`,
    expectedLabel: targetLocationLabel,
    choices,
    correctChoiceIds: [correct.id],
    requiresMapAnswer: false,
    showTargetOnMap: false,
    allowsSecondAttempt: false,
  });
}

function buildFeatureFromLocation(target: QuizFeature, pool: QuizFeature[]) {
  const targetLocationLabel = featureLocationLabel(target, false);

  if (!targetLocationLabel) {
    return null;
  }

  const correct = {
    id: target.properties.id,
    label: target.properties.name,
    detail: target.properties.categoryLabel,
  };
  const distractors = getDistractorFeatures(target, pool, { sameTopic: true, excludeSameName: true }).map(
    (feature) => ({
      id: feature.properties.id,
      label: feature.properties.name,
      detail: feature.properties.categoryLabel,
    }),
  );
  const choices = makeChoices(correct, distractors);

  if (choices.length < 4) {
    return null;
  }

  return makeQuestion("featureFromLocation", target, {
    prompt: `${targetLocationLabel} KPSS çalışmasında hangi unsurla eşleşir?`,
    helper: "Merkezden unsura git.",
    answerSummary: `${targetLocationLabel}: ${target.properties.name}.`,
    expectedLabel: target.properties.name,
    choices,
    correctChoiceIds: [correct.id],
    requiresMapAnswer: false,
    showTargetOnMap: false,
    allowsSecondAttempt: false,
  });
}

function buildNotInCategory(target: QuizFeature, pool: QuizFeature[]) {
  const inCategory = uniqueBy(
    pool.filter((feature) => feature.properties.category === target.properties.category),
    (feature) => featureDisplayName(feature),
  );
  const outCategory = uniqueBy(
    pool.filter(
      (feature) =>
        feature.properties.topic === target.properties.topic &&
        feature.properties.category !== target.properties.category,
    ),
    (feature) => featureDisplayName(feature),
  );

  if (inCategory.length < 3 || outCategory.length < 1) {
    return null;
  }

  const correctFeature = randomItem(outCategory);
  const correct = choiceFromFeature(correctFeature);
  const choices = makeChoices(correct, shuffle(inCategory).slice(0, 3).map(choiceFromFeature));

  if (choices.length < 4) {
    return null;
  }

  return makeQuestion("notInCategory", correctFeature, {
    prompt: `Aşağıdakilerden hangisi ${target.properties.categoryLabel} grubunda değildir?`,
    helper: "Aykırı olan seçeneği bul.",
    answerSummary: `${featureDisplayName(correctFeature)} farklı kategoridedir: ${correctFeature.properties.categoryLabel}.`,
    expectedLabel: featureDisplayName(correctFeature),
    choices,
    correctChoiceIds: [correct.id],
    requiresMapAnswer: false,
    showTargetOnMap: false,
    allowsSecondAttempt: false,
  });
}

function buildTrueFalse(target: QuizFeature) {
  const categories = categoryOptionsForTopic(target.properties.topic).filter(
    (category) => category.id !== target.properties.category,
  );
  const shouldBeTrue = Math.random() > 0.45 || categories.length === 0;
  const statementCategory = shouldBeTrue ? target.properties.categoryLabel : randomItem(categories).label;
  const correctChoiceId = shouldBeTrue ? "true" : "false";

  return makeQuestion("trueFalse", target, {
    prompt: `${featureDisplayName(target)}, ${statementCategory} örneğidir.`,
    helper: "İfadeyi doğru/yanlış olarak değerlendir.",
    answerSummary: `${featureDisplayName(target)} için doğru kategori: ${target.properties.categoryLabel}.`,
    expectedLabel: correctChoiceId === "true" ? "Doğru" : "Yanlış",
    choices: [
      { id: "true", label: "Doğru" },
      { id: "false", label: "Yanlış" },
    ],
    correctChoiceIds: [correctChoiceId],
    requiresMapAnswer: false,
    showTargetOnMap: false,
    allowsSecondAttempt: false,
  });
}

function buildIIiI(target: QuizFeature, pool: QuizFeature[]) {
  const sameCategory = uniqueBy(
    pool.filter((feature) => feature.properties.category === target.properties.category),
    (feature) => featureDisplayName(feature),
  );
  const otherCategory = uniqueBy(
    pool.filter(
      (feature) =>
        feature.properties.topic === target.properties.topic &&
        feature.properties.category !== target.properties.category,
    ),
    (feature) => featureDisplayName(feature),
  );

  if (sameCategory.length < 2 || otherCategory.length < 1) {
    return null;
  }

  const rows = shuffle([...shuffle(sameCategory).slice(0, 2), randomItem(otherCategory)]).map((feature, index) => ({
    roman: ["I", "II", "III"][index],
    feature,
    isCorrect: feature.properties.category === target.properties.category,
  }));
  const correctRomans = rows.filter((row) => row.isCorrect).map((row) => row.roman);
  const correctId = correctRomans.join("-");
  const romanOptions = [
    { id: "I", label: "Yalnız I" },
    { id: "II", label: "Yalnız II" },
    { id: "III", label: "Yalnız III" },
    { id: "I-II", label: "I ve II" },
    { id: "I-III", label: "I ve III" },
    { id: "II-III", label: "II ve III" },
    { id: "I-II-III", label: "I, II ve III" },
  ];
  const correct = romanOptions.find((option) => option.id === correctId);

  if (!correct) {
    return null;
  }

  const choices = shuffle([correct, ...shuffle(romanOptions.filter((option) => option.id !== correctId)).slice(0, 3)]);

  return makeQuestion("iIiI", target, {
    prompt: `${rows
      .map((row) => `${row.roman}. ${featureDisplayName(row.feature)}`)
      .join(" / ")} — hangileri ${target.properties.categoryLabel} grubundadır?`,
    helper: "KPSS öncüllü soru düzeninde doğru öncülleri seç.",
    answerSummary: `Doğru öncüller: ${correct.label}.`,
    expectedLabel: correct.label,
    choices,
    correctChoiceIds: [correct.id],
    requiresMapAnswer: false,
    showTargetOnMap: false,
    allowsSecondAttempt: false,
  });
}

function buildBestExplanation(target: QuizFeature) {
  const template = bestExplanationTemplates[target.properties.category];

  if (!template) {
    return null;
  }

  const correct = {
    id: "correct",
    label: template.correct,
  };
  const choices = makeChoices(
    correct,
    template.wrong.map((label, index) => ({ id: `wrong_${index}`, label })),
  );

  return makeQuestion("bestExplanation", target, {
    prompt: `${featureDisplayName(target)} için en uygun KPSS açıklaması hangisidir?`,
    helper: "Kavramın neden o bölgede veya kategoride öne çıktığını seç.",
    answerSummary: template.correct,
    expectedLabel: template.correct,
    choices,
    correctChoiceIds: [correct.id],
    requiresMapAnswer: false,
    showTargetOnMap: false,
    allowsSecondAttempt: false,
  });
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

function nearestFeature(target: QuizFeature, pool: QuizFeature[]) {
  const targetPoint = featurePoint(target);

  if (!targetPoint) {
    return null;
  }

  return pool
    .filter((feature) => feature.properties.id !== target.properties.id)
    .map((feature) => {
      const point = featurePoint(feature);

      return point ? { feature, distanceKm: getDistanceKm(targetPoint, point) } : null;
    })
    .filter((item): item is { feature: QuizFeature; distanceKm: number } => Boolean(item))
    .sort((left, right) => left.distanceKm - right.distanceKm)[0]?.feature ?? null;
}

function buildNearbyConcept(target: QuizFeature, pool: QuizFeature[]) {
  const nearest = nearestFeature(target, pool);

  if (!nearest) {
    return null;
  }

  const correct = choiceFromFeature(nearest);
  const distractors = getDistractorFeatures(nearest, pool, { excludeSameName: false })
    .filter((feature) => feature.properties.id !== target.properties.id)
    .map(choiceFromFeature);
  const choices = makeChoices(correct, distractors);

  if (choices.length < 4) {
    return null;
  }

  return makeQuestion("nearbyConcept", target, {
    prompt: `${featureDisplayName(target)} noktasına en yakın KPSS unsuru hangisidir?`,
    helper: "Haritadaki yakınlık ilişkisini düşün.",
    answerSummary: `En yakın unsur: ${featureDisplayName(nearest)}.`,
    expectedLabel: featureDisplayName(nearest),
    choices,
    correctChoiceIds: [correct.id],
    requiresMapAnswer: false,
    showTargetOnMap: true,
    allowsSecondAttempt: false,
  });
}

function buildSimilarDisambiguation(target: QuizFeature, pool: QuizFeature[]) {
  const targetLocationLabel = featureLocationLabel(target);
  const sameName = pool.filter(
    (feature) =>
      feature.properties.id !== target.properties.id && feature.properties.name === target.properties.name,
  );

  if (sameName.length < 1) {
    return null;
  }

  const correct = {
    id: target.properties.id,
    label: targetLocationLabel,
    detail: target.properties.categoryLabel,
  };
  const distractors = sameName
    .filter((feature) => featureLocationLabel(feature) !== targetLocationLabel)
    .map((feature) => ({
      id: feature.properties.id,
      label: featureLocationLabel(feature),
      detail: feature.properties.categoryLabel,
    }));
  const fallbackDistractors = getDistractorFeatures(target, pool, { sameTopic: true })
    .filter((feature) => featureLocationLabel(feature) !== targetLocationLabel)
    .map((feature) => ({
      id: feature.properties.id,
      label: featureLocationLabel(feature),
      detail: feature.properties.name,
    }))
    .filter((choice) => choice.label);
  const choices = makeChoices(correct, [...distractors, ...fallbackDistractors]);

  if (choices.length < 4) {
    return null;
  }

  return makeQuestion("similarDisambiguation", target, {
    prompt: `${target.properties.name} benzer kayıtları arasında bu kayıt hangi konumdadır?`,
    helper: "Aynı veya benzer adları karıştırmamaya odaklan.",
    answerSummary: `${target.properties.name} - ${targetLocationLabel}.`,
    expectedLabel: targetLocationLabel,
    choices,
    correctChoiceIds: [correct.id],
    requiresMapAnswer: false,
    showTargetOnMap: false,
    allowsSecondAttempt: false,
  });
}

function kindCandidates(mode: QuizMode, difficulty: QuizDifficulty): QuestionKind[] {
  if (mode === "mapLocate") {
    return ["mapLocate"];
  }

  if (mode === "reverseMapIdentify") {
    return ["reverseMapIdentify"];
  }

  if (mode === "category") {
    return ["categoryChoice"];
  }

  if (mode === "matching") {
    return ["locationMatch", "featureFromLocation", "similarDisambiguation"];
  }

  if (mode === "kpss") {
    return ["notInCategory", "trueFalse", "iIiI", "bestExplanation", "nearbyConcept", "similarDisambiguation"];
  }

  if (difficulty === "easy") {
    return [
      "categoryChoice",
      "locationMatch",
      "featureFromLocation",
      "trueFalse",
      "reverseMapIdentify",
      "mapLocate",
    ];
  }

  if (difficulty === "hard") {
    return [
      "notInCategory",
      "iIiI",
      "bestExplanation",
      "nearbyConcept",
      "similarDisambiguation",
      "mapLocate",
      "reverseMapIdentify",
    ];
  }

  return [
    "mapLocate",
    "reverseMapIdentify",
    "categoryChoice",
    "locationMatch",
    "featureFromLocation",
    "notInCategory",
    "trueFalse",
  ];
}

function buildQuestionByKind(
  kind: QuestionKind,
  target: QuizFeature,
  pool: QuizFeature[],
  difficulty: QuizDifficulty,
) {
  switch (kind) {
    case "mapLocate":
      return buildMapLocate(target, difficulty);
    case "reverseMapIdentify":
      return buildReverseMapIdentify(target, pool);
    case "categoryChoice":
      return buildCategoryChoice(target);
    case "locationMatch":
      return buildLocationMatch(target, pool);
    case "featureFromLocation":
      return buildFeatureFromLocation(target, pool);
    case "notInCategory":
      return buildNotInCategory(target, pool);
    case "trueFalse":
      return buildTrueFalse(target);
    case "iIiI":
      return buildIIiI(target, pool);
    case "bestExplanation":
      return buildBestExplanation(target);
    case "nearbyConcept":
      return buildNearbyConcept(target, pool);
    case "similarDisambiguation":
      return buildSimilarDisambiguation(target, pool);
  }
}

export function generateQuizQuestion({
  features,
  mode,
  difficulty,
  previousQuestionId,
  reviewFeatureIds,
}: {
  features: QuizFeature[];
  mode: QuizMode;
  difficulty: QuizDifficulty;
  previousQuestionId: string | null;
  reviewFeatureIds: string[];
}) {
  const availableFeatures =
    mode === "review" && reviewFeatureIds.length > 0
      ? features.filter((feature) => reviewFeatureIds.includes(feature.properties.id))
      : features;
  const pool = availableFeatures.filter((feature) => featurePoint(feature));

  if (pool.length === 0) {
    return null;
  }

  const previousFeatureId = previousQuestionId?.split("_").slice(1, -2).join("_") ?? null;
  const targets = shuffle(
    pool.length > 1
      ? pool.filter((feature) => feature.properties.id !== previousFeatureId)
      : pool,
  );
  const kinds = shuffle(kindCandidates(mode === "review" ? "mixed" : mode, difficulty));

  for (const kind of kinds) {
    for (const target of targets) {
      const question = buildQuestionByKind(kind, target, pool, difficulty);

      if (question) {
        return question;
      }
    }
  }

  return buildMapLocate(randomItem(pool), difficulty);
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

export function getFeatureCategoryLabel(feature: QuizFeature) {
  return getCategoryLabel(feature.properties.category);
}
