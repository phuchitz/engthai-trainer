/**
 * Short synthesised feedback tones.
 *
 * Synthesised rather than shipped as audio files: two sine blips cost nothing to
 * download and keep the offline bundle small. Entirely optional — `settings.soundEnabled`
 * gates every call, and a browser without Web Audio simply stays silent.
 */

type AudioContextConstructor = new () => AudioContext;

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!Ctor) return null;

  context ??= new Ctor();
  // Browsers start the context suspended until a gesture; every call here follows one.
  if (context.state === "suspended") void context.resume();
  return context;
}

export function isSoundSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext,
  );
}

function blip(frequencies: number[], durationMs: number): void {
  const ctx = getContext();
  if (!ctx) return;

  const step = durationMs / 1000 / frequencies.length;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);

  // A short attack and release: a raw square edge clicks.
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);

  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(ctx.currentTime + index * step);
    oscillator.stop(ctx.currentTime + (index + 1) * step);
  });
}

/**
 * A rising arpeggio for a pass.
 *
 * Three notes rather than two, and a major triad rather than an octave leap: it lands as
 * an arrival instead of a beep. Short enough that hearing it forty times in a session is
 * not a punishment for studying.
 */
export function playSuccess(): void {
  blip([659.25, 783.99, 1046.5], 260);
}

/** A brighter flourish, kept for the moments worth marking rather than every pass. */
export function playCelebration(): void {
  blip([659.25, 783.99, 987.77, 1318.5], 420);
}

/** A single low tone for a miss: lower and shorter, so it never feels punitive. */
export function playMiss(): void {
  blip([220], 140);
}
