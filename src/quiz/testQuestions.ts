/**
 * Metin tabanlı "Test Soru Modu" için saf veri modeli ve soru seçici.
 * Harita/Soru+ mantığından bağımsızdır. Sorular runtime'da
 * `/questions/tarih.json`'dan yüklenir (bkz. useTestQuestions).
 *
 * Bu modül saftır: yan etki yok. Rastgelelik yalnız `pickNextTestQuestion`
 * içinde `Math.random` ile; çağıran taraf "son sorulanlar" listesini tutar.
 */

export type TestOptionKey = "A" | "B" | "C" | "D" | "E";

/** Test modunun ana kategorileri (oyunlaştırma konusuyla birebir eşleşir). */
export type TestCategory = "tarih" | "vatandaslik" | "cografya";

export type TestOption = {
  key: TestOptionKey;
  /** Metin sorularında zorunlu; görselli sorularda (yalnız A–E düğmeleri) opsiyonel. */
  text?: string;
};

export type TestQuestion = {
  id: string;
  /** Metin sorularında zorunlu; görselli soruda gerekmeyebilir. */
  prompt?: string;
  /** Görselli soru: kök-mutlak resim URL'si (ör. "/images/cografya/cog-0001.png"). */
  image?: string;
  options: TestOption[];
  correct: TestOptionKey;
  category: TestCategory;
  topic?: string;
  year?: number;
};

export type TestStudyMode = "all" | "wrong";

/** Kategori seçici: "all" => karma (tüm kategoriler). */
export type TestCategoryFilter = "all" | TestCategory;

export const TEST_CATEGORY_LABELS: Record<TestCategory, string> = {
  tarih: "Tarih",
  vatandaslik: "Vatandaşlık",
  cografya: "Coğrafya",
};

const VALID_KEYS: readonly TestOptionKey[] = ["A", "B", "C", "D", "E"];

function isOptionKey(value: unknown): value is TestOptionKey {
  return typeof value === "string" && (VALID_KEYS as readonly string[]).includes(value);
}

/** Ham JSON kaydını doğrulayıp `TestQuestion`'a çevirir; geçersizse null. */
export function parseTestQuestion(value: unknown, category: TestCategory): TestQuestion | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const { id, prompt, image, options, correct, topic, year } = record;

  if (typeof id !== "string" || id.length === 0) return null;
  if (!isOptionKey(correct)) return null;
  if (!Array.isArray(options) || options.length < 2) return null;

  // Görselli soru: `image` dolu bir string ise soru kökü/şıklar resimde gömülüdür.
  const isImageQuestion = typeof image === "string" && image.length > 0;

  // Metin sorusunda prompt zorunlu; görselli soruda opsiyonel.
  if (!isImageQuestion && (typeof prompt !== "string" || prompt.length === 0)) return null;

  const parsedOptions: TestOption[] = [];
  for (const raw of options) {
    if (typeof raw !== "object" || raw === null) return null;
    const { key, text } = raw as Record<string, unknown>;
    if (!isOptionKey(key)) return null;
    if (isImageQuestion) {
      // Görselli soruda şık metni opsiyonel (yalnız A–E harfi gösterilir).
      parsedOptions.push({ key, text: typeof text === "string" && text.length > 0 ? text : undefined });
    } else {
      if (typeof text !== "string" || text.length === 0) return null;
      parsedOptions.push({ key, text });
    }
  }

  // Doğru cevap şıklardan biri olmalı.
  if (!parsedOptions.some((option) => option.key === correct)) return null;

  return {
    id,
    prompt: typeof prompt === "string" && prompt.length > 0 ? prompt : undefined,
    image: isImageQuestion ? (image as string) : undefined,
    options: parsedOptions,
    correct,
    category,
    topic: typeof topic === "string" ? topic : undefined,
    year: typeof year === "number" ? year : undefined,
  };
}

/** Ham JSON dizisini geçerli sorulara indirger (geçersizleri atar). */
export function parseTestQuestions(value: unknown, category: TestCategory): TestQuestion[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null && Array.isArray((value as { questions?: unknown }).questions)
      ? (value as { questions: unknown[] }).questions
      : [];

  const result: TestQuestion[] = [];
  for (const item of list) {
    const parsed = parseTestQuestion(item, category);
    if (parsed) result.push(parsed);
  }
  return result;
}

/**
 * Karışık (rastgele) sırayla bir sonraki soruyu seçer.
 * - `wrongIds` verilir (study === "wrong") ise havuz yalnız o id'lerle sınırlanır.
 * - `recentIds` içindeki sorular mümkünse tekrar edilmez (havuz onları kapsamıyorsa yine seçilir).
 * Aday kalmazsa null döner.
 */
export function pickNextTestQuestion(
  pool: TestQuestion[],
  recentIds: string[],
  study: TestStudyMode = "all",
  wrongIds: string[] = [],
): TestQuestion | null {
  let candidates = pool;

  if (study === "wrong") {
    const wrongSet = new Set(wrongIds);
    candidates = pool.filter((question) => wrongSet.has(question.id));
  }

  if (candidates.length === 0) {
    return null;
  }

  const recentSet = new Set(recentIds);
  const fresh = candidates.filter((question) => !recentSet.has(question.id));
  const usable = fresh.length > 0 ? fresh : candidates;

  const index = Math.floor(Math.random() * usable.length);
  return usable[index] ?? null;
}
