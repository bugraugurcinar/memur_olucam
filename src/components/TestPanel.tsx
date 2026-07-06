import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  pickNextTestQuestion,
  type TestOptionKey,
  type TestQuestion,
  type TestStudyMode,
} from "../quiz/testQuestions";

const RECENT_TEST_QUESTION_HISTORY_LIMIT = 8;
const TEST_TOKEN_COLOR = "#6366f1";

export type TestPanelProps = {
  questions: TestQuestion[];
  isLoading: boolean;
  error: string | null;
  wrongIds: string[];
  onAnswer: (payload: { questionId: string; isCorrect: boolean }) => void;
};

export function TestPanel({ questions, isLoading, error, wrongIds, onAnswer }: TestPanelProps) {
  const [studyMode, setStudyMode] = useState<TestStudyMode>("all");
  const [current, setCurrent] = useState<TestQuestion | null>(null);
  const [answeredKey, setAnsweredKey] = useState<TestOptionKey | null>(null);
  const recentIdsRef = useRef<string[]>([]);

  // "Yanlışlar" havuzu study seçimi anındaki id'lerle sabitlensin ki bir soruyu
  // yanıtlayıp havuzdan düşürünce anlık pool değişmesin (döngü akışını bozmaz).
  const wrongIdsRef = useRef<string[]>(wrongIds);
  wrongIdsRef.current = wrongIds;

  const advance = useCallback(
    (mode: TestStudyMode) => {
      const next = pickNextTestQuestion(questions, recentIdsRef.current, mode, wrongIdsRef.current);
      if (next) {
        recentIdsRef.current = [next.id, ...recentIdsRef.current].slice(
          0,
          RECENT_TEST_QUESTION_HISTORY_LIMIT,
        );
      }
      setAnsweredKey(null);
      setCurrent(next);
    },
    [questions],
  );

  // İlk soruyu (veya havuz boşaldıysa) yükle.
  useEffect(() => {
    if (questions.length === 0 || current) {
      return;
    }
    advance(studyMode);
  }, [advance, current, questions.length, studyMode]);

  const handleStudyModeChange = useCallback(
    (mode: TestStudyMode) => {
      if (mode === studyMode) {
        return;
      }
      setStudyMode(mode);
      recentIdsRef.current = [];
      advance(mode);
    },
    [advance, studyMode],
  );

  const handleSelect = useCallback(
    (key: TestOptionKey) => {
      if (!current || answeredKey) {
        return;
      }
      const isCorrect = key === current.correct;
      setAnsweredKey(key);
      onAnswer({ questionId: current.id, isCorrect });
    },
    [answeredKey, current, onAnswer],
  );

  const handleNext = useCallback(() => {
    advance(studyMode);
  }, [advance, studyMode]);

  if (isLoading) {
    return (
      <div className="test-stage">
        <div className="test-empty glass" role="status">
          <strong>Sorular yükleniyor…</strong>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="test-stage">
        <div className="test-empty glass" role="alert">
          <strong>Sorular yüklenemedi</strong>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const wrongCount = wrongIds.length;
  const isAnswered = Boolean(answeredKey);
  const correctKey = current?.correct ?? null;

  return (
    <div className="test-stage">
      <div className="test-panel glass">
        <div className="quiz-section-heading">
          <h2>Test Soru Modu</h2>
          <span>KPSS Tarih çıkmış sorular · karışık</span>
        </div>

        <div className="test-study-switch" role="group" aria-label="Çalışma havuzu">
          <button
            className={studyMode === "all" ? "is-active" : ""}
            onClick={() => handleStudyModeChange("all")}
            type="button"
          >
            Tümü
          </button>
          <button
            className={studyMode === "wrong" ? "is-active" : ""}
            disabled={wrongCount === 0}
            onClick={() => handleStudyModeChange("wrong")}
            type="button"
          >
            Yanlışlar ({wrongCount})
          </button>
        </div>

        {current ? (
          <div
            key={current.id}
            className={`quiz-card plus-card${
              isAnswered ? (answeredKey === correctKey ? " quiz-card--correct" : " quiz-card--wrong") : ""
            }`}
          >
            <span className="quiz-card__eyebrow">
              {current.topic ?? "Tarih"}
              {current.year ? ` · ${current.year}` : ""}
            </span>
            <strong className="test-prompt">{current.prompt}</strong>

            <div className="test-choice-list" aria-label="Seçenekler">
              {current.options.map((option) => {
                const isSelected = answeredKey === option.key;
                const isCorrectOption = isAnswered && option.key === correctKey;
                const isWrongOption = isSelected && option.key !== correctKey;
                const className = [
                  "plus-token",
                  isSelected && !isAnswered ? "plus-token--selected" : "",
                  isCorrectOption ? "plus-token--correct" : "",
                  isWrongOption ? "plus-token--wrong" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    className={className}
                    disabled={isAnswered}
                    key={option.key}
                    onClick={() => handleSelect(option.key)}
                    style={{ "--plus-token-color": TEST_TOKEN_COLOR } as CSSProperties}
                    type="button"
                  >
                    <span>
                      {option.key}) {option.text}
                    </span>
                  </button>
                );
              })}
            </div>

            {isAnswered ? (
              <div className="quiz-result">
                <strong>{answeredKey === correctKey ? "Doğru" : "Yanlış"}</strong>
                <span>
                  Doğru cevap: {correctKey}){" "}
                  {current.options.find((option) => option.key === correctKey)?.text ?? ""}
                </span>
              </div>
            ) : null}

            <div className="quiz-actions plus-actions">
              <button disabled={!isAnswered} onClick={handleNext} type="button">
                Sonraki soru
              </button>
            </div>
          </div>
        ) : (
          <div className="test-empty">
            <strong>
              {studyMode === "wrong" ? "Yanlış soru havuzun boş." : "Gösterilecek soru bulunamadı."}
            </strong>
            {studyMode === "wrong" ? (
              <button onClick={() => handleStudyModeChange("all")} type="button">
                Tüm sorulara dön
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
