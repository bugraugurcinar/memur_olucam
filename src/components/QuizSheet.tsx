import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AutoAdvanceBar } from "./AutoAdvanceBar";
import { BottomSheet, type SheetSnap } from "./BottomSheet";
import { QUIZ_CORRECT_RADIUS_KM } from "../quiz/geoUtils";
import {
  plusQuestionKindLabels,
  plusQuestionModeOptions,
  plusQuestionTopicOptions,
  type PlusAvailability,
  type PlusQuestion,
  type PlusQuestionMode,
  type PlusQuestionTopic,
} from "../quiz/plusQuestionEngine";
import type { SessionStats } from "../quiz/gamification";

export type PlusStudyMode = "all" | "wrong";

export type PlusAnswerState = {
  isCorrect: boolean;
  message: string;
  detail: string;
  wrongTargetIds: string[];
  selectedTokenId: string | null;
};

type PlusTopicId = Exclude<PlusQuestionTopic, "mixed">;

const plusTopicChoices = plusQuestionTopicOptions.filter(
  (option): option is { id: PlusTopicId; label: string } => option.id !== "mixed",
);

// Cevap yüzeyi haritanın kendisi olan soru türleri: sheet peek'e iner.
const MAP_FIRST_KINDS: ReadonlySet<PlusQuestion["kind"]> = new Set(["mapLocate", "pickOne", "pickMany"]);

export type QuizSheetProps = {
  question: PlusQuestion | null;
  answer: PlusAnswerState | null;
  availabilityLabel: string;
  availability: PlusAvailability;
  studyMode: PlusStudyMode;
  mode: PlusQuestionMode;
  topics: PlusTopicId[];
  canStart: boolean;
  wrongCount: number;
  wrongStatus: string;
  session: SessionStats;
  districtsLoading: boolean;
  districtsError: string | null;
  assignments: Record<string, string>;
  selectedTokenId: string | null;
  selectedTargetCount: number;
  autoAdvanceDurationMs: number;
  autoAdvanceRemainingMs: number;
  submitVisible: boolean;
  submitDisabled: boolean;
  onStudyModeChange: (mode: PlusStudyMode) => void;
  onWrongPoolClear: () => void;
  onModeChange: (mode: PlusQuestionMode) => void;
  onTopicToggle: (topic: PlusTopicId) => void;
  onTopicsClear: () => void;
  onPrimaryAction: () => void;
  onTokenSelect: (tokenId: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

/** Soru+ sekmesinin katlanabilir alt sayfası: kurulum kontrolleri + canlı soru kartı. */
export function QuizSheet({
  question,
  answer,
  availabilityLabel,
  availability,
  studyMode,
  mode,
  topics,
  canStart,
  wrongCount,
  wrongStatus,
  session,
  districtsLoading,
  districtsError,
  assignments,
  selectedTokenId,
  selectedTargetCount,
  autoAdvanceDurationMs,
  autoAdvanceRemainingMs,
  submitVisible,
  submitDisabled,
  onStudyModeChange,
  onWrongPoolClear,
  onModeChange,
  onTopicToggle,
  onTopicsClear,
  onPrimaryAction,
  onTokenSelect,
  onSubmit,
  onClose,
}: QuizSheetProps) {
  const [snap, setSnap] = useState<SheetSnap>("full");
  const questionId = question?.id ?? null;
  const questionKind = question?.kind ?? null;
  const hasAnswer = Boolean(answer);

  // Soru türüne göre otomatik snap: harita-etkileşimli sorularda harita açılır,
  // cevap gelince sonuç okunacak kadar yer açılır, soru yokken kontroller tam görünür.
  useEffect(() => {
    if (!questionId || !questionKind) {
      setSnap("full");
      return;
    }
    if (hasAnswer) {
      setSnap("half");
      return;
    }
    setSnap(MAP_FIRST_KINDS.has(questionKind) ? "peek" : "half");
  }, [hasAnswer, questionId, questionKind]);

  const tokenById = useMemo(
    () => new Map(question?.tokens.map((token) => [token.id, token]) ?? []),
    [question],
  );
  const wrongTargetIds = answer?.wrongTargetIds ?? [];

  return (
    <BottomSheet snap={snap} onSnapChange={setSnap} className="quiz-sheet" ariaLabel="Soru+">
      {question ? (
        <div
          key={question.id}
          className={`quiz-card plus-card${answer ? (answer.isCorrect ? " quiz-card--correct" : " quiz-card--wrong") : ""}`}
        >
          <span className="quiz-card__eyebrow">
            {question.title} · {plusQuestionKindLabels[question.kind]}
          </span>
          <strong>{question.prompt}</strong>
          <p>{answer ? answer.message : question.helper}</p>

          {question.kind === "placement" || question.kind === "choice" || question.kind === "mapMatch" ? (
            <div className="plus-token-list" aria-label="Soru+ etiketleri">
              {question.tokens.map((token) => {
                const isSelected = selectedTokenId === token.id || answer?.selectedTokenId === token.id;
                const isCorrectToken = answer && token.id === question.correctTokenId;
                const isWrongToken = answer?.selectedTokenId === token.id && token.id !== question.correctTokenId;
                const className = [
                  "plus-token",
                  isSelected ? "plus-token--selected" : "",
                  isCorrectToken ? "plus-token--correct" : "",
                  isWrongToken ? "plus-token--wrong" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    className={className}
                    disabled={Boolean(answer)}
                    key={token.id}
                    onClick={() => onTokenSelect(token.id)}
                    style={{ "--plus-token-color": token.color } as CSSProperties}
                    type="button"
                  >
                    <span>{token.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {question.kind === "mapLocate" && question.topic !== "district" && !answer ? (
            <div className="quiz-map-hint">
              <span>{QUIZ_CORRECT_RADIUS_KM} km</span>
              <strong>Haritada tahmin noktanı bırak</strong>
            </div>
          ) : null}

          {question.kind === "mapLocate" && question.topic === "district" && !answer ? (
            <div className="quiz-map-hint">
              <span>Sınır içi</span>
              <strong>İlçe sınırları içine tıkla</strong>
            </div>
          ) : null}

          {question.kind === "placement" ? (
            <div className="plus-target-list" aria-label="Soru+ yerleştirme durumu">
              {question.targets.map((target) => {
                const assignedToken = tokenById.get(assignments[target.id]);
                const isWrong = wrongTargetIds.includes(target.id);
                const isCorrect = answer && !isWrong;

                return (
                  <div
                    className={`plus-target-row${isCorrect ? " plus-target-row--correct" : ""}${isWrong ? " plus-target-row--wrong" : ""}`}
                    key={target.id}
                  >
                    <strong>{target.label}</strong>
                    <span>{assignedToken?.label ?? "Boş"}</span>
                    {answer ? <small>{target.name}</small> : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {question.kind === "pickMany" && !answer ? (
            <div className="quiz-map-hint">
              <span>{selectedTargetCount} seçili</span>
              <strong>Doğru noktaların tamamını işaretle</strong>
            </div>
          ) : null}

          {answer ? (
            <div className="quiz-result">
              <strong>{answer.isCorrect ? "Doğru" : "Yanlış"}</strong>
              <span>{answer.detail}</span>
            </div>
          ) : null}

          {answer ? (
            <AutoAdvanceBar
              durationMs={autoAdvanceDurationMs}
              remainingMs={autoAdvanceRemainingMs}
              variant={answer.isCorrect ? "correct" : "wrong"}
            />
          ) : null}

          {answer ? <p className="quiz-note">{question.kpssNote}</p> : null}

          <div className="quiz-actions plus-actions">
            {answer ? (
              <button className="quiz-launch-button" disabled={!canStart} onClick={onPrimaryAction} type="button">
                Sonraki soru
              </button>
            ) : submitVisible ? (
              <button disabled={submitDisabled} onClick={onSubmit} type="button">
                {question.submitLabel}
              </button>
            ) : null}
            <button className="quiz-actions__secondary" onClick={onClose} type="button">
              Soru+ kapat
            </button>
          </div>
        </div>
      ) : (
        <div className="panel-section plus-panel">
          <div className="quiz-section-heading">
            <h2>Soru+</h2>
            <span>{availabilityLabel}</span>
          </div>

          <div className="plus-study-mode" aria-label="Soru+ çalışma modu">
            <button aria-pressed={studyMode === "all"} onClick={() => onStudyModeChange("all")} type="button">
              Tüm sorular
            </button>
            <button
              aria-pressed={studyMode === "wrong"}
              disabled={wrongCount === 0}
              onClick={() => onStudyModeChange("wrong")}
              type="button"
            >
              Yanlışları çalış
              <small>{wrongCount}</small>
            </button>
          </div>

          {studyMode === "wrong" ? (
            <div className="wrong-question-pool" role="status">
              <div>
                <strong>Yanlış havuzu</strong>
                <span>{wrongStatus}</span>
              </div>
              {wrongCount > 0 ? (
                <button onClick={onWrongPoolClear} type="button">
                  Temizle
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="quiz-control-grid" aria-label="Soru+ seçenekleri">
            <label>
              <span>Soru Tipi</span>
              <select value={mode} onChange={(event) => onModeChange(event.target.value as PlusQuestionMode)}>
                {plusQuestionModeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="plus-topic-select" aria-label="Soru+ konuları">
            <div className="plus-topic-select__heading">
              <span>Konular</span>
              <span className="plus-topic-select__hint">
                {topics.length === 0 ? "Tümü seçili" : `${topics.length} konu`}
              </span>
            </div>
            <div className="plus-topic-chip-list">
              <button aria-pressed={topics.length === 0} className="category-chip" onClick={onTopicsClear} type="button">
                Tümü
              </button>
              {plusTopicChoices.map((option) => {
                const isActive = topics.includes(option.id);
                const count = availability.byTopic[option.id];
                // İlçe verisi lazy-load edildiği için sayı yüklenene kadar 0'dır —
                // bu yüzden sıfır sayıya göre devre dışı bırakılmaz, yalnızca
                // gerçek bir yükleme hatasında devre dışı kalır.
                const isDistrictChip = option.id === "district";
                const isChipDisabled = isDistrictChip ? Boolean(districtsError) : count === 0;
                const chipCountLabel = isDistrictChip && districtsLoading ? "…" : count;

                return (
                  <button
                    aria-pressed={isActive}
                    className="category-chip"
                    disabled={isChipDisabled}
                    key={option.id}
                    onClick={() => onTopicToggle(option.id)}
                    type="button"
                  >
                    {option.label}
                    <small>{chipCountLabel}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            className="quiz-launch-button plus-launch-button"
            disabled={!canStart}
            onClick={onPrimaryAction}
            type="button"
          >
            Soru+ başlat
          </button>

          {session.answered > 0 ? (
            <div className="plus-session-strip" role="status">
              <span>
                {session.correct}/{session.answered} doğru
              </span>
              <span>Seri: {session.currentStreak}</span>
            </div>
          ) : null}
        </div>
      )}
    </BottomSheet>
  );
}
