import { useEffect, useState } from "react";
import { parseTestQuestions, type TestQuestion } from "../quiz/testQuestions";

/**
 * `useGeoJson` ile aynı deseni izler: `public/`'ten runtime `fetch` ile test
 * soru bankasını yükler ve doğrulanmış `TestQuestion[]`'e çevirir.
 */

type TestQuestionsState = {
  data: TestQuestion[];
  error: string | null;
  isLoading: boolean;
};

export function useTestQuestions(url: string): TestQuestionsState {
  const [state, setState] = useState<TestQuestionsState>({
    data: [],
    error: null,
    isLoading: true,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadQuestions() {
      setState({ data: [], error: null, isLoading: true });

      try {
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }

        const raw = (await response.json()) as unknown;
        const questions = parseTestQuestions(raw);

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
  }, [url]);

  return state;
}
