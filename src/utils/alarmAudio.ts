let sharedAudioContext: AudioContext | null = null;
let activeWakeLock: { release: () => Promise<void> } | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new AudioCtx();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

export function formatKoreanVocative(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const lastCode = trimmed.charCodeAt(trimmed.length - 1);
  if (lastCode >= 0xac00 && lastCode <= 0xd7a3) {
    const hasBatchim = (lastCode - 0xac00) % 28 !== 0;
    return `${trimmed}${hasBatchim ? '아' : '야'}`;
  }
  return `${trimmed}아`;
}

export function buildTimerEndMessage(childName: string, minutes: number): string {
  return `${formatKoreanVocative(childName)} ${minutes}분 다 됐어. 유튜브 꺼주세요~`;
}

/**
 * Unlocks Web Audio synchronously inside a user click gesture
 * so mobile browsers (iOS Safari / Android Chrome) allow chime playback when the countdown reaches 00:00.
 */
export function unlockAlarmAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Ignore audio unlock failures
  }
}

function scheduleBellChime(ctx: AudioContext): void {
  const notes = [
    { freq: 1046.5, delay: 0, duration: 0.42 }, // C6
    { freq: 1318.51, delay: 0.14, duration: 0.42 }, // E6
    { freq: 1567.98, delay: 0.28, duration: 0.46 }, // G6
    { freq: 2093.0, delay: 0.42, duration: 0.72 } // C7
  ];

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.75, ctx.currentTime);
  master.connect(ctx.destination);

  const now = ctx.currentTime + 0.02;

  notes.forEach(({ freq, delay, duration }) => {
    const start = now + delay;

    // Fundamental warm sine tone
    const mainOsc = ctx.createOscillator();
    const mainGain = ctx.createGain();
    mainOsc.type = 'sine';
    mainOsc.frequency.setValueAtTime(freq, start);

    mainGain.gain.setValueAtTime(0.0001, start);
    mainGain.gain.linearRampToValueAtTime(0.28, start + 0.015);
    mainGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    mainOsc.connect(mainGain);
    mainGain.connect(master);
    mainOsc.start(start);
    mainOsc.stop(start + duration + 0.03);

    // Subtle 2nd-harmonic bell shimmer
    const overtoneOsc = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtoneOsc.type = 'sine';
    overtoneOsc.frequency.setValueAtTime(freq * 2, start);

    overtoneGain.gain.setValueAtTime(0.0001, start);
    overtoneGain.gain.linearRampToValueAtTime(0.06, start + 0.01);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, start + duration * 0.55);

    overtoneOsc.connect(overtoneGain);
    overtoneGain.connect(master);
    overtoneOsc.start(start);
    overtoneOsc.stop(start + duration * 0.6 + 0.02);
  });
}

export function playAlarmMelody(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        scheduleBellChime(ctx);
      });
    } else {
      scheduleBellChime(ctx);
    }
  } catch {
    // Ignore audio playback errors
  }
}

export function playAlarmTestSound(): void {
  unlockAlarmAudio();
  playAlarmMelody();
}

export function startContinuousAlarmSound(shouldContinue: () => boolean): () => void {
  let stopped = false;

  const triggerIfActive = () => {
    if (stopped) return;
    if (!shouldContinue()) {
      stopped = true;
      clearInterval(intervalId);
      return;
    }
    playAlarmMelody();
  };

  playAlarmMelody();
  const intervalId = setInterval(triggerIfActive, 2200);

  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}

export async function requestScreenWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
  };
  if (!nav.wakeLock || activeWakeLock) return;

  try {
    activeWakeLock = await nav.wakeLock.request('screen');
  } catch {
    // Wake lock can fail if battery saver is active or permission denied
  }
}

export async function releaseScreenWakeLock(): Promise<void> {
  if (!activeWakeLock) return;
  const lock = activeWakeLock;
  activeWakeLock = null;
  try {
    await lock.release();
  } catch {
    // Ignore wake lock release errors
  }
}
