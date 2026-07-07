import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  pickNextTestQuestion,
  TEST_CATEGORY_LABELS,
  type TestCategory,
  type TestCategoryFilter,
  type TestOptionKey,
  type TestQuestion,
  type TestStudyMode,
} from "../quiz/testQuestions";

const RECENT_TEST_QUESTION_HISTORY_LIMIT = 8;
const TEST_TOKEN_COLOR = "#6366f1";
// Süreli mod: her soru için geri sayım (saniye). Süre dolarsa soru yanlış sayılır.
const QUESTION_TIME_SECONDS = 30;

const CATEGORY_FILTERS: Array<{ id: TestCategoryFilter; label: string }> = [
  { id: "all", label: "Karma" },
  { id: "tarih", label: TEST_CATEGORY_LABELS.tarih },
  { id: "vatandaslik", label: TEST_CATEGORY_LABELS.vatandaslik },
  { id: "cografya", label: TEST_CATEGORY_LABELS.cografya },
];

// "Karma" sekmesi ipucu: tüm kategori etiketleri.
const ALL_CATEGORY_HINT = CATEGORY_FILTERS.filter((filter) => filter.id !== "all")
  .map((filter) => filter.label)
  .join(" + ");

export type TestPanelProps = {
  questions: TestQuestion[];
  isLoading: boolean;
  error: string | null;
  wrongIds: string[];
  onAnswer: (payload: { questionId: string; isCorrect: boolean; category: TestCategory }) => void;
};

export function TestPanel({ questions, isLoading, error, wrongIds, onAnswer }: TestPanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<TestCategoryFilter>("all");
  const [studyMode, setStudyMode] = useState<TestStudyMode>("all");
  const [current, setCurrent] = useState<TestQuestion | null>(null);
  const [answeredKey, setAnsweredKey] = useState<TestOptionKey | null>(null);
  const [timedMode, setTimedMode] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [remaining, setRemaining] = useState(QUESTION_TIME_SECONDS);
  const recentIdsRef = useRef<string[]>([]);

  // Seçili kategoriye göre havuz. "all" => karma (tüm kategoriler).
  const pool = useMemo(
    () =>
      categoryFilter === "all"
        ? questions
        : questions.filter((question) => question.category === categoryFilter),
    [questions, categoryFilter],
  );

  // "Yanlışlar" havuzu study seçimi anındaki id'lerle sabitlensin ki bir soruyu
  // yanıtlayıp havuzdan düşürünce anlık pool değişmesin (döngü akışını bozmaz).
  const wrongIdsRef = useRef<string[]>(wrongIds);
  wrongIdsRef.current = wrongIds;

  const advance = useCallback(
    (mode: TestStudyMode) => {
      const next = pickNextTestQuestion(pool, recentIdsRef.current, mode, wrongIdsRef.current);
      if (next) {
        recentIdsRef.current = [next.id, ...recentIdsRef.current].slice(
          0,
          RECENT_TEST_QUESTION_HISTORY_LIMIT,
        );
      }
      setAnsweredKey(null);
      setTimedOut(false);
      setRemaining(QUESTION_TIME_SECONDS);
      setCurrent(next);
    },
    [pool],
  );

  // İlk soruyu (veya havuz boşaldıysa) yükle.
  useEffect(() => {
    if (pool.length === 0 || current) {
      return;
    }
    advance(studyMode);
  }, [advance, current, pool.length, studyMode]);

  const handleCategoryChange = useCallback(
    (next: TestCategoryFilter) => {
      if (next === categoryFilter) {
        return;
      }
      setCategoryFilter(next);
      recentIdsRef.current = [];
      // Havuz değişince (yeni pool bir sonraki render'da geçerli olur) mevcut soruyu
      // temizle; useEffect yeni havuzdan soru çeker.
      setAnsweredKey(null);
      setCurrent(null);
    },
    [categoryFilter],
  );

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
      if (!current || answeredKey || timedOut) {
        return;
      }
      const isCorrect = key === current.correct;
      setAnsweredKey(key);
      onAnswer({ questionId: current.id, isCorrect, category: current.category });
    },
    [answeredKey, current, onAnswer, timedOut],
  );

  const isAnswered = Boolean(answeredKey) || timedOut;

  // Süreli mod: cevaplanmamış her soruda geri sayım; süre bitince yanlış sayılır.
  useEffect(() => {
    if (!timedMode || !current || isAnswered) {
      return;
    }
    setRemaining(QUESTION_TIME_SECONDS);
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const left = QUESTION_TIME_SECONDS - Math.floor((Date.now() - startedAt) / 1000);
      if (left <= 0) {
        window.clearInterval(interval);
        setRemaining(0);
        setTimedOut(true);
        onAnswer({ questionId: current.id, isCorrect: false, category: current.category });
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [timedMode, current, isAnswered, onAnswer]);

  const handleNext = useCallback(() => {
    advance(studyMode);
  }, [advance, studyMode]);

  // Seçili kategori havuzundaki yanlış soru sayısı ("Yanlışlar" düğmesi için).
  const wrongCount = useMemo(() => {
    const poolIds = new Set(pool.map((question) => question.id));
    return wrongIds.filter((id) => poolIds.has(id)).length;
  }, [pool, wrongIds]);

  // Kategori değişince yanlış havuzu boşaldıysa "Tümü" havuzuna düş.
  useEffect(() => {
    if (studyMode === "wrong" && wrongCount === 0) {
      setStudyMode("all");
    }
  }, [studyMode, wrongCount]);

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

  const correctKey = current?.correct ?? null;
  const categoryHint =
    categoryFilter === "all" ? ALL_CATEGORY_HINT : TEST_CATEGORY_LABELS[categoryFilter];

  return (
    <div className="test-stage">
      <div className="test-panel glass">
        <div className="quiz-section-heading">
          <h2>Test Soru Modu</h2>
          <span>KPSS çıkmış sorular · {categoryHint} · karışık</span>
        </div>

        <div className="test-study-switch" role="group" aria-label="Kategori">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              className={categoryFilter === filter.id ? "is-active" : ""}
              key={filter.id}
              onClick={() => handleCategoryChange(filter.id)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
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
          <button
            className={`test-timed-toggle${timedMode ? " is-active" : ""}`}
            onClick={() => setTimedMode((value) => !value)}
            title="Süreli mod: her soru için 30 sn"
            type="button"
          >
            ⏱ Süreli
          </button>
        </div>

        {timedMode && current && !isAnswered ? (
          <div
            className={`test-timer${remaining <= 10 ? " is-urgent" : ""}`}
            role="timer"
            aria-label={`${remaining} saniye kaldı`}
          >
            <div className="test-timer__track">
              <div
                className="test-timer__fill"
                style={{ width: `${(remaining / QUESTION_TIME_SECONDS) * 100}%` }}
              />
            </div>
            <strong>{remaining}s</strong>
          </div>
        ) : null}

        {current ? (
          <div
            key={current.id}
            className={`quiz-card plus-card${
              isAnswered ? (answeredKey === correctKey ? " quiz-card--correct" : " quiz-card--wrong") : ""
            }`}
          >
            <span className="quiz-card__eyebrow">
              {TEST_CATEGORY_LABELS[current.category]}
              {current.topic ? ` · ${current.topic}` : ""}
              {current.year ? ` · ${current.year}` : ""}
            </span>
            {current.prompt ? <strong className="test-prompt">{current.prompt}</strong> : null}
            {current.image ? (
              <img className="test-question-image" src={current.image} alt="Soru görseli" />
            ) : null}

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
                    <span>{option.text ? `${option.key}) ${option.text}` : option.key}</span>
                  </button>
                );
              })}
            </div>

            {isAnswered ? (
              <div className="quiz-result">
                <strong>{timedOut ? "Süre doldu" : answeredKey === correctKey ? "Doğru" : "Yanlış"}</strong>
                <span>
                  Doğru cevap: {correctKey}
                  {current.options.find((option) => option.key === correctKey)?.text
                    ? `) ${current.options.find((option) => option.key === correctKey)?.text}`
                    : ""}
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
