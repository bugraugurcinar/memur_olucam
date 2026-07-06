import { useEffect, useMemo, useState } from "react";
import { parseTestQuestions, type TestCategory, type TestQuestion } from "../quiz/testQuestions";

/**
 * `useGeoJson` ile aynı deseni izler: `public/`'ten runtime `fetch` ile test
 * soru bankalarını yükler ve doğrulanmış `TestQuestion[]`'e çevirir. Birden çok
 * kategori kaynağı (Tarih, Vatandaşlık) verilebilir; hepsi tek havuzda birleşir
 * ve her soru kaynağına göre `category` ile etiketlenir.
 */

export type TestQuestionSource = {
  url: string;
  category: TestCategory;
};

type TestQuestionsState = {
  data: TestQuestion[];
  error: string | null;
  isLoading: boolean;
};

export function useTestQuestions(sources: TestQuestionSource[]): TestQuestionsState {
  const [state, setState] = useState<TestQuestionsState>({
    data: [],
    error: null,
    isLoading: true,
  });

  // Kaynak listesi her render'da yeni referans olmasın diye sabit bir anahtar üret.
  const sourcesKey = useMemo(
    () => sources.map((source) => `${source.category}:${source.url}`).join("|"),
    [sources],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadQuestions() {
      setState({ data: [], error: null, isLoading: true });

      try {
        const perSource = await Promise.all(
          sources.map(async (source) => {
            const response = await fetch(source.url, { signal: controller.signal });
            if (!response.ok) {
              throw new Error(`${source.url}: ${response.status} ${response.statusText}`);
            }
            const raw = (await response.json()) as unknown;
            return parseTestQuestions(raw, source.category);
          }),
        );

        const questions = perSource.flat();

        if (questions.length === 0) {
          throw new Error("Geçerli test sorusu bulunamadı.");
        }

        setState({ data: questions, error: null, isLoading: false });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          data: [],
          error: error instanceof Error ? error.message : "Sorular yüklenemedi.",
          isLoading: false,
        });
      }
    }

    void loadQuestions();

    return () => {
      controller.abort();
    };
    // sourcesKey, sources içeriğini temsil eder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey]);

  return state;
}
