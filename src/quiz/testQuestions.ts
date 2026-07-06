/**
 * Metin tabanlı "Test Soru Modu" için saf veri modeli ve soru seçici.
 * Harita/Soru+ mantığından bağımsızdır. Sorular runtime'da
 * `/questions/tarih.json`'dan yüklenir (bkz. useTestQuestions).
 *
 * Bu modül saftır: yan etki yok. Rastgelelik yalnız `pickNextTestQuestion`
 * içinde `Math.random` ile; çağıran taraf "son sorulanlar" listesini tutar.
 */

export type TestOptionKey = "A" | "B" | "C" | "D" | "E";

export type TestOption = {
  key: TestOptionKey;
  text: string;
};

export type TestQuestion = {
  id: string;
  prompt: string;
  options: TestOption[];
  correct: TestOptionKey;
  topic?: string;
  year?: number;
};

export type TestStudyMode = "all" | "wrong";

const VALID_KEYS: readonly TestOptionKey[] = ["A", "B", "C", "D", "E"];

function isOptionKey(value: unknown): value is TestOptionKey {
  return typeof value === "string" && (VALID_KEYS as readonly string[]).includes(value);
}

/** Ham JSON kaydını doğrulayıp `TestQuestion`'a çevirir; geçersizse null. */
export function parseTestQuestion(value: unknown): TestQuestion | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const { id, prompt, options, correct, topic, year } = record;

  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof prompt !== "string" || prompt.length === 0) return null;
  if (!isOptionKey(correct)) return null;
  if (!Array.isArray(options) || options.length < 2) return null;

  const parsedOptions: TestOption[] = [];
  for (const raw of options) {
    if (typeof raw !== "object" || raw === null) return null;
    const { key, text } = raw as Record<string, unknown>;
    if (!isOptionKey(key) || typeof text !== "string" || text.length === 0) return null;
    parsedOptions.push({ key, text });
  }

  // Doğru cevap şıklardan biri olmalı.
  if (!parsedOptions.some((option) => option.key === correct)) return null;

  return {
    id,
    prompt,
    options: parsedOptions,
    correct,
    topic: typeof topic === "string" ? topic : undefined,
    year: typeof year === "number" ? year : undefined,
  };
}

/** Ham JSON dizisini geçerli sorulara indirger (geçersizleri atar). */
export function parseTestQuestions(value: unknown): TestQuestion[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null && Array.isArray((value as { questions?: unknown }).questions)
      ? (value as { questions: unknown[] }).questions
      : [];

  const result: TestQuestion[] = [];
  for (const item of list) {
    const parsed = parseTestQuestion(item);
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
