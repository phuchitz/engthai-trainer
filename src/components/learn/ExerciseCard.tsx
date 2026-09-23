"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { announceResult, BAND_LABELS } from "@/lib/answer";
import { CATEGORY_INFO } from "@/lib/models";
import { MODE_INFO } from "@/lib/exercises";
import { hasVoiceFor, isSpeechSupported, speak } from "@/lib/speech/tts";
import { useStudyStore } from "@/stores/useStudyStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { playCelebration, playMiss, playSuccess } from "@/lib/audio/feedback";
import { NavIcon } from "@/components/layout/NavIcon";
import { useT } from "@/components/display/preferences";
import { GREAT_PRAISE, PERFECT_PRAISE, pickPhrase } from "@/lib/i18n";
import { ClickableSentence } from "@/components/vocab/ClickableSentence";
import { WordPanelHost } from "@/components/vocab/WordPanelHost";
import { AnswerDiff, DiffLegend } from "./AnswerDiff";
import { Shortcut } from "./Shortcut";
import { WordOrderInput } from "./inputs/WordOrderInput";
import { FillBlankInput } from "./inputs/FillBlankInput";
import { SpeakInput } from "./inputs/SpeakInput";
import { MultipleChoiceInput } from "./inputs/MultipleChoiceInput";

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
    multipleChoice,
    choice,
    setChoice,
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

  const { t, language } = useT();
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
  const optionCount = multipleChoice?.options.length ?? 0;

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
        : mode === "multipleChoice"
          ? choice !== null
          : mode === "speak"
            ? transcript !== null
            : answer.trim().length > 0;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      markActivity();
      if (event.ctrlKey || event.metaKey) return;

      // Multiple Choice has no text field, so bare digits are free to use. Guarded by
      // the mode, because in every other mode a digit is something the learner is typing.
      if (mode === "multipleChoice" && phase === "prompt" && !event.altKey) {
        const picked = Number(event.key) - 1;
        if (Number.isInteger(picked) && picked >= 0 && picked < optionCount) {
          event.preventDefault();
          setChoice(picked);
          return;
        }
      }

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
  }, [phase, play, showHint, skip, retry, submit, next, markActivity, mode, optionCount, setChoice]);

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
        <span>{t("learn.card.of", { index: index + 1, total: cards.length })}</span>
        <span className="flex items-center gap-3 tabular-nums">
          <span>{t("learn.xp", { amount: sessionXp })}</span>
          <span>🔥 {streak}</span>
          <span>{t("learn.goal", { done: cardsToday, total: dailyGoal, percent: goalPercent })}</span>
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
            {t("learn.listen")}
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
              aria-label={t("learn.replay.label")}
            >
              <NavIcon path={SPEAKER_ICON} className="size-4" />
              {t("learn.replay")}
              <Shortcut keys="Alt+P" />
            </button>
          </div>
        )}

        {replayDisabled ? (
          <p className="text-muted mt-2 text-xs">
            {!speechAvailable
              ? t("learn.noVoice.none")
              : t("learn.noVoice.lang", {
                  language: t(info.promptLanguage === "th" ? "language.thai" : "language.english"),
                })}
            {mode === "dictation" ? t("learn.noVoice.shown") : ""}
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
        ) : mode === "multipleChoice" ? (
          <MultipleChoiceInput />
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
              {t("learn.check")}
              <Shortcut keys="Enter" />
            </button>
            <button
              type="button"
              onClick={showHint}
              disabled={hintUsed}
              className="border-border rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
            >
              {t("learn.hint")}
              <Shortcut keys="Alt+H" />
            </button>
            <button
              type="button"
              onClick={() => void skip()}
              disabled={submitting}
              className="text-muted rounded-lg px-4 py-2 text-sm"
            >
              {t("learn.skip")}
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
  const { cards, index, outcome, vocabulary, retry, next, selfAssess, streak, cardsToday, dailyGoal } =
    useStudyStore();
  const settings = useSettingsStore((s) => s.settings);
  const { t } = useT();
  const card = cards[index];
  const passed = outcome?.verdict === "correct" || outcome?.verdict === "close";
  // Worth a flourish rather than the usual tone: the first of the day, or the one that
  // finishes it. Anything more often and the flourish stops meaning anything.
  const milestone = passed && (cardsToday === 1 || (dailyGoal > 0 && cardsToday === dailyGoal));

  // One tone per graded answer, only when the learner has turned sound on.
  useEffect(() => {
    if (!outcome || !settings?.soundEnabled) return;
    if (!passed) playMiss();
    else if (milestone) playCelebration();
    else playSuccess();
  }, [outcome, passed, milestone, settings?.soundEnabled]);

  if (!outcome || !card) return null;
  const { sentence, mode } = card;

  const { result } = outcome;
  const answerText = MODE_INFO[mode].answerLanguage === "th" ? sentence.th : sentence.en;
  const secondary = MODE_INFO[mode].answerLanguage === "th" ? sentence.en : sentence.th;

  // Chosen from the card, not at random: random praise re-rolls on every re-render, and
  // the same phrase every time reads like a stuck recording.
  const praiseKeys = result.band === "perfect" ? PERFECT_PRAISE : GREAT_PRAISE;
  const praise = passed && result.band !== "good" ? t(pickPhrase(praiseKeys, index + sentence.id.length)) : null;

  return (
    <div
      className={`border-border bg-surface space-y-4 rounded-xl border p-5 ${
        passed ? "border-success/40 animate-celebrate celebrate-sheen" : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className={`animate-grade-pop text-lg font-semibold ${BAND_TONE[result.band]}`}>
            {BAND_LABELS[result.band]}
          </p>
          {praise ? <p className="text-success text-sm font-medium">{praise}</p> : null}
        </div>
        <p className="text-muted text-sm tabular-nums">{result.accuracy}%</p>
      </div>

      {passed ? (
        <p className="text-muted text-xs">
          {milestone && dailyGoal > 0 && cardsToday === dailyGoal
            ? t("praise.goalMet")
            : cardsToday === 1
              ? t("praise.firstToday")
              : streak > 1
                ? t("praise.streak", { days: streak })
                : ""}
        </p>
      ) : null}

      {mode === "speak" ? (
        <p className="text-muted text-xs">
          Transcript similarity, not pronunciation assessment — recognition can mishear a perfectly good
          sentence.
        </p>
      ) : null}

      {mode === "fillBlank" ? (
        <p className="text-muted text-xs">Only the missing words were scored.</p>
      ) : null}

      {mode === "multipleChoice" ? (
        <p className="text-muted text-xs">
          Scored all or nothing — the alternatives are real sentences, so being close to one is not being
          right.
        </p>
      ) : null}

      <div>
        <AnswerDiff ops={result.ops} />
        <DiffLegend />
      </div>

      <div className="border-border space-y-2 border-t pt-4">
        <p className="text-muted text-xs tracking-wide uppercase">{t("learn.answer")}</p>
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
        <p className="text-muted text-xs">{t("learn.tapWord")}</p>
        <WordPanelHost />
      </div>

      {result.band !== "perfect" && sentence.notes ? (
        <div className="border-border border-t pt-4">
          <p className="text-muted text-xs tracking-wide uppercase">{t("learn.why")}</p>
          <p lang="th" className="mt-1 text-sm">
            {sentence.notes}
          </p>
        </div>
      ) : null}

      {sentence.exampleEn ? (
        <div className="border-border border-t pt-4">
          <p className="text-muted text-xs tracking-wide uppercase">{t("learn.another")}</p>
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
          <p className="text-muted text-xs tracking-wide uppercase">{t("learn.vocabulary")}</p>
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
            <span className="text-success font-medium">
              {t("learn.xp.earned", { amount: outcome.xpAwarded })}
            </span>
          ) : outcome.xpWasNew ? (
            <span className="text-muted">{t("learn.xp.none")}</span>
          ) : (
            <span className="text-muted">{t("learn.xp.already")}</span>
          )}
        </p>
        {!outcome.scheduled ? (
          <p className="text-muted mt-1 text-xs">
            {/* Two different reasons a card did not move, and saying the wrong one would
                misreport what the app just did. */}
            {t(MODE_INFO[mode].schedules ? "learn.schedule.already" : "learn.schedule.practiceOnly")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void next()}
          className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
        >
          {t("learn.next")}
          <Shortcut keys="Enter" />
        </button>
        <button type="button" onClick={retry} className="border-border rounded-lg border px-4 py-2 text-sm">
          {t("learn.retry")}
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
