/**
 * Thin wrapper over the Web Speech API.
 *
 * Every entry point is a no-op when speech synthesis is missing or the platform has no
 * voice for the language, because a missing voice must degrade to a silent button rather
 * than an error — the exercise still works without audio.
 */

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  return window.speechSynthesis.getVoices();
}

export function hasVoiceFor(languagePrefix: string): boolean {
  return listVoices().some((voice) => voice.lang.toLowerCase().startsWith(languagePrefix.toLowerCase()));
}

export type SpeakOptions = {
  lang?: string;
  rate?: number;
  voiceName?: string | null;
  onEnd?: () => void;
};

export function speak(text: string, options: SpeakOptions = {}): boolean {
  if (!isSpeechSupported() || text.trim().length === 0) return false;

  const { lang = "en-US", rate = 1, voiceName = null, onEnd } = options;

  // Chrome queues utterances, so a second tap would otherwise play both in sequence.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;

  const voices = listVoices();
  const chosen =
    (voiceName ? voices.find((v) => v.name === voiceName) : undefined) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  if (chosen) utterance.voice = chosen;

  if (onEnd) {
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
  }

  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
