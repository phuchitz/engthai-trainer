"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { announceResult, BAND_LABELS } from "@/lib/answer";
import { CATEGORY_INFO } from "@/lib/models";
import { MODE_INFO } from "@/lib/exercises";
import { hasVoiceFor, isSpeechSupported, speak } from "@/lib/speech/tts";
import { useStudyStore } from "@/stores/useStudyStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { playMiss, playSuccess } from "@/lib/audio/feedback";
import { NavIcon } from "@/components/layout/NavIcon";
import { ClickableSentence } from "@/components/vocab/ClickableSentence";
import { WordPanelHost } from "@/components/vocab/WordPanelHost";
import { AnswerDiff, DiffLegend } from "./AnswerDiff";
import { Shortcut } from "./Shortcut";
import { WordOrderInput } from "./inputs/WordOrderInput";
import { FillBlankInput } from "./inputs/FillBlankInput";
import { SpeakInput } from "./inputs/SpeakInput";

const SPEAKER_ICON = "M11 5 6 9H2v6h4l5 4V5Zm4.5 3a5 5 0 0 1 0 8m2.5-11a9 9 0 0 1 0 14";

const BAND_TONE = {
  perfect: "text-success",
  great: "text-success",
  good: "text-warning",
  tryAgain: "text-danger",
} as const;

const NO_SUBSCRIPTION = () => () => {};
const SERVER_SNAPSHOT = () => false;

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="bg-surface-muted text-muted rounded-md px-2 py-1 text-xs">{children}</span>;
}

export function ExerciseCard() {
  const store = useStudyStore();
  const {
    cards,
    index,
    phase,
    answer,
    hintUsed,
    outcome,
    placed,
    blankAnswers,
    transcript,
    sessionXp,
    cardsToday,
    dailyGoal,
    streak,
    submitting,
    setAnswer,
    markActivity,
    setHidden,
    showHint,
    markTtsUsed,
    submit,
    retry,
    skip,
    next,
  } = store;

  const card = cards[index];
  const sentence = card?.sentence;
  // The mode belongs to the card, not the session: a review queue mixes them.
  const mode = card?.mode ?? "dictation";
  const info = MODE_INFO[mode];
  const inputRef = useRef<HTMLInputElement>(null);

  const speechAvailable = useSyncExternalStore(NO_SUBSCRIPTION, isSpeechSupported, SERVER_SNAPSHOT);
  const promptVoice = useSyncExternalStore(
    NO_SUBSCRIPTION,
    useCallback(() => hasVoiceFor(info.promptLanguage), [info.promptLanguage]),
    SERVER_SNAPSHOT,
  );

  const promptText = sentence ? (info.promptLanguage === "th" ? sentence.th : sentence.en) : "";

  const play = useCallback(() => {
    if (!sentence) return;
    markTtsUsed();
    speak(promptText, { lang: info.promptLanguage === "th" ? "th-TH" : "en-US" });
  }, [sentence, promptText, info.promptLanguage, markTtsUsed]);

  const typesAnswer = mode === "dictation" || mode === "translate";

  useEffect(() => {
    if (phase === "prompt" && typesAnswer) inputRef.current?.focus();
  }, [phase, index, typesAnswer]);

  // A backgrounded tab earns no study time.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [setHidden]);

  const canSubmit =
    mode === "wordOrder"
      ? placed.length > 0
      : mode === "fillBlank"
        ? blankAnswers.some((v) => v.trim().length > 0)
        : mode === "speak"
          ? transcript !== null
          : answer.trim().length > 0;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      markActivity();
      if (event.ctrlKey || event.metaKey) return;

      // Alt combinations produce no characters, so they stay usable while a text field
      // has focus — which it does in most of these modes.
      if (event.altKey) {
        const handlers: Record<string, (() => void) | undefined> = {
          p: play,
          h: phase === "prompt" ? showHint : undefined,
          s: phase === "prompt" ? () => void skip() : undefined,
          r: phase === "graded" ? retry : undefined,
        };
        const handler = handlers[event.key.toLowerCase()];
        if (handler) {
          event.preventDefault();
          handler();
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (phase === "prompt") void submit();
        else if (phase === "graded") void next();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, play, showHint, skip, retry, submit, next, markActivity]);

  if (!sentence) return null;

  const graded = phase === "graded" && outcome !== null;
  const goalPercent = dailyGoal > 0 ? Math.min(100, Math.round((cardsToday / dailyGoal) * 100)) : 0;
  const replayDisabled = !speechAvailable || !promptVoice;

  return (
    <div className="space-y-5">
      {/* The grade is a colour, a percentage and a colour-coded diff on screen, none of
          which reads aloud. This region is mounted for the whole session so a change to
          its text is announced; it restates the verdict, the score and the wrong words. */}
      <p role="status" aria-live="polite" className="sr-only">
        {graded && outcome
          ? announceResult(outcome.result, {
              xpAwarded: outcome.xpAwarded,
              transcriptOnly: mode === "speak",
              blanksOnly: mode === "fillBlank",
            })
          : ""}
      </p>

      <div className="text-muted flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          Card {index + 1} of {cards.length}
        </span>
        <span className="flex items-center gap-3 tabular-nums">
          <span>+{sessionXp} XP</span>
          <span>🔥 {streak}</span>
          <span>
            Goal {cardsToday}/{dailyGoal} ({goalPercent}%)
          </span>
        </span>
      </div>

      <div className="border-border bg-surface rounded-xl border p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge>{sentence.level}</Badge>
          <Badge>{CATEGORY_INFO[sentence.category].label}</Badge>
          <Badge>{info.label}</Badge>
        </div>

        {/* Dictation and Speaking are the modes where the audio *is* the prompt. */}
        {mode === "dictation" || mode === "speak" ? (
          <button
            type="button"
            onClick={play}
            disabled={replayDisabled}
            className="bg-accent text-accent-foreground flex w-full items-center justify-center gap-2 rounded-lg px-4 py-4 text-sm font-medium disabled:opacity-50"
          >
            <NavIcon path={SPEAKER_ICON} className="size-5" />
            Listen
            <Shortcut keys="Alt+P" />
          </button>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <p lang={info.promptLanguage} className="text-xl">
              {promptText}
            </p>
            <button
              type="button"
              onClick={play}
              disabled={replayDisabled}
              className="border-border text-muted flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40"
              aria-label="Replay the prompt"
            >
              <NavIcon path={SPEAKER_ICON} className="size-4" />
              Replay
              <Shortcut keys="Alt+P" />
            </button>
          </div>
        )}

        {replayDisabled ? (
          <p className="text-muted mt-2 text-xs">
            {!speechAvailable
              ? "This browser has no speech synthesis."
              : `No ${info.promptLanguage === "th" ? "Thai" : "English"} voice is installed, so audio is unavailable.`}
            {mode === "dictation" ? " The sentence is shown instead." : ""}
          </p>
        ) : null}

        {mode === "dictation" && replayDisabled && !graded ? (
          <p className="mt-3 text-lg">{sentence.en}</p>
        ) : null}

        <p className="text-muted mt-5 mb-2 text-sm" id="exercise-instruction">
          {info.instruction}
        </p>

        {typesAnswer ? (
          <input
            id="exercise-answer"
            ref={inputRef}
            value={graded ? outcome.result.normalizedUser : answer}
            onChange={(e) => setAnswer(e.target.value)}
            readOnly={graded}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            lang="en"
            aria-labelledby="exercise-instruction"
            className="border-border bg-background focus:border-accent w-full rounded-lg border px-3 py-2.5 text-lg outline-none read-only:opacity-60"
            placeholder="…"
          />
        ) : mode === "wordOrder" ? (
          <WordOrderInput />
        ) : mode === "fillBlank" ? (
          <FillBlankInput />
        ) : (
          <SpeakInput />
        )}

        {hintUsed && !graded ? <HintPanel /> : null}

        {!graded ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || !canSubmit}
              className="bg-foreground text-background rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Check
              <Shortcut keys="Enter" />
            </button>
            <button
              type="button"
              onClick={showHint}
              disabled={hintUsed}
              className="border-border rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
            >
              Hint
              <Shortcut keys="Alt+H" />
            </button>
            <button
              type="button"
              onClick={() => void skip()}
              disabled={submitting}
              className="text-muted rounded-lg px-4 py-2 text-sm"
            >
              Skip
              <Shortcut keys="Alt+S" />
            </button>
          </div>
        ) : null}
      </div>

      {graded ? <Feedback /> : null}
    </div>
  );
}

/** Each mode needs a different nudge: the hint must not simply be the answer. */
function HintPanel() {
  const { cards, index, fillBlank } = useStudyStore();
  const card = cards[index];
  if (!card) return null;
  const { sentence, mode } = card;

  return (
    <div className="border-border mt-4 space-y-1 rounded-lg border border-dashed p-3">
      {mode === "dictation" ? (
        <p lang="th" className="text-sm">
          {sentence.th}
        </p>
      ) : null}

      {mode === "translate" || mode === "speak" ? (
        <p className="text-sm">
          Starts with: <span className="font-medium">{sentence.en.split(" ").slice(0, 2).join(" ")}…</span>
        </p>
      ) : null}

      {mode === "wordOrder" && sentence.transliteration ? (
        <p className="text-sm">{sentence.transliteration}</p>
      ) : null}

      {mode === "fillBlank" && fillBlank ? (
        <p className="text-sm">
          First letters:{" "}
          <span className="font-medium">
            {fillBlank.blanks.map((b) => `${b.answer.charAt(0)}…`).join("  ")}
          </span>
        </p>
      ) : null}

      {sentence.hint ? (
        <p className="text-muted text-xs" lang="th">
          {sentence.hint}
        </p>
      ) : null}
    </div>
  );
}

function Feedback() {
  const { cards, index, outcome, vocabulary, retry, next, selfAssess } = useStudyStore();
  const settings = useSettingsStore((s) => s.settings);
  const card = cards[index];
  const passed = outcome?.verdict === "correct" || outcome?.verdict === "close";

  // One tone per graded answer, only when the learner has turned sound on.
  useEffect(() => {
    if (!outcome || !settings?.soundEnabled) return;
    if (passed) playSuccess();
    else playMiss();
  }, [outcome, passed, settings?.soundEnabled]);

  if (!outcome || !card) return null;
  const { sentence, mode } = card;

  const { result } = outcome;
  const answerText = MODE_INFO[mode].answerLanguage === "th" ? sentence.th : sentence.en;
  const secondary = MODE_INFO[mode].answerLanguage === "th" ? sentence.en : sentence.th;

  return (
    <div className="border-border bg-surface space-y-4 rounded-xl border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`animate-grade-pop text-lg font-semibold ${BAND_TONE[result.band]}`}>
          {BAND_LABELS[result.band]}
        </p>
        <p className="text-muted text-sm tabular-nums">{result.accuracy}%</p>
      </div>

      {mode === "speak" ? (
        <p className="text-muted text-xs">
          Transcript similarity, not pronunciation assessment — recognition can mishear a perfectly good
          sentence.
        </p>
      ) : null}

      {mode === "fillBlank" ? (
        <p className="text-muted text-xs">Only the missing words were scored.</p>
      ) : null}

      <div>
        <AnswerDiff ops={result.ops} />
        <DiffLegend />
      </div>

      <div className="border-border space-y-2 border-t pt-4">
        <p className="text-muted text-xs tracking-wide uppercase">Answer</p>
        {MODE_INFO[mode].answerLanguage === "th" ? (
          <>
            <p lang="th" className="text-lg">
              {answerText}
            </p>
            {/* The English side is the tappable one: word lookup is curated for English. */}
            <ClickableSentence text={secondary} sentenceId={sentence.id} className="text-muted" />
          </>
        ) : (
          <>
            <ClickableSentence text={answerText} sentenceId={sentence.id} className="text-lg" />
            <p lang="th" className="text-muted">
              {secondary}
            </p>
          </>
        )}
        {sentence.transliteration ? <p className="text-muted text-xs">{sentence.transliteration}</p> : null}
        <p className="text-muted text-xs">Tap any English word to look it up.</p>
        <WordPanelHost />
      </div>

      {result.band !== "perfect" && sentence.notes ? (
        <div className="border-border border-t pt-4">
          <p className="text-muted text-xs tracking-wide uppercase">Why</p>
          <p lang="th" className="mt-1 text-sm">
            {sentence.notes}
          </p>
        </div>
      ) : null}

      {sentence.exampleEn ? (
        <div className="border-border border-t pt-4">
          <p className="text-muted text-xs tracking-wide uppercase">Another example</p>
          <p className="mt-1 text-sm">{sentence.exampleEn}</p>
          {sentence.exampleTh ? (
            <p lang="th" className="text-muted text-sm">
              {sentence.exampleTh}
            </p>
          ) : null}
        </div>
      ) : null}

      {vocabulary.length > 0 ? (
        <div className="border-border border-t pt-4">
          <p className="text-muted text-xs tracking-wide uppercase">Vocabulary</p>
          <ul className="mt-2 space-y-1">
            {vocabulary.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-4 text-sm">
                <span>{entry.en}</span>
                <span lang="th" className="text-muted">
                  {entry.th}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-border border-t pt-4">
        <p className="text-sm">
          {outcome.xpAwarded > 0 ? (
            <span className="text-success font-medium">+{outcome.xpAwarded} XP</span>
          ) : outcome.xpWasNew ? (
            <span className="text-muted">No XP — that answer was not a pass.</span>
          ) : (
            <span className="text-muted">Already earned XP for this card today.</span>
          )}
        </p>
        {!outcome.scheduled ? (
          <p className="text-muted mt-1 text-xs">
            Schedule already updated for this card today, so this attempt was practice only.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void next()}
          className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
        >
          Next
          <Shortcut keys="Enter" />
        </button>
        <button type="button" onClick={retry} className="border-border rounded-lg border px-4 py-2 text-sm">
          Retry
          <Shortcut keys="Alt+R" />
        </button>
        {mode === "speak" && result.band !== "perfect" ? (
          <button
            type="button"
            onClick={() => void selfAssess(true)}
            className="text-muted rounded-lg px-4 py-2 text-sm underline"
          >
            Recognition misheard me
          </button>
        ) : null}
      </div>
    </div>
  );
}
