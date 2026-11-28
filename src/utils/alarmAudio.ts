let sharedAudioContext: AudioContext | null = null;
let activeWakeLock: { release: () => Promise<void> } | null = null;

type MediaMode = 'idle' | 'keepalive' | 'alarm';

let sharedAlarmAudioEl: HTMLAudioElement | null = null;
let mediaMode: MediaMode = 'idle';
let cachedSilentKeepAliveUrl: string | null = null;
let cachedAlarmChimeUrl: string | null = null;

export type AlarmNotificationPermission = NotificationPermission | 'unsupported';

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

function encodeMonoWavBlobUrl(samples: Float32Array, sampleRate: number): string {
  const numSamples = samples.length;
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function getSilentKeepAliveWavUrl(): string {
  if (cachedSilentKeepAliveUrl) return cachedSilentKeepAliveUrl;
  const sampleRate = 8000;
  const totalSamples = sampleRate * 1; // 1 second
  const samples = new Float32Array(totalSamples);
  // Inaudible -90dB signal so mobile OS keeps media audio session alive
  for (let i = 0; i < totalSamples; i += 1) {
    samples[i] = Math.sin((2 * Math.PI * 1 * i) / sampleRate) * 0.00005;
  }
  cachedSilentKeepAliveUrl = encodeMonoWavBlobUrl(samples, sampleRate);
  return cachedSilentKeepAliveUrl;
}

function getAlarmChimeWavUrl(): string {
  if (cachedAlarmChimeUrl) return cachedAlarmChimeUrl;
  const sampleRate = 22050;
  const durationSec = 2.2;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { freq: 1046.5, delay: 0.02, duration: 0.42 }, // C6
    { freq: 1318.51, delay: 0.16, duration: 0.42 }, // E6
    { freq: 1567.98, delay: 0.3, duration: 0.46 }, // G6
    { freq: 2093.0, delay: 0.44, duration: 0.72 } // C7
  ];

  for (const note of notes) {
    const startIdx = Math.floor(note.delay * sampleRate);
    const noteSamples = Math.floor(note.duration * sampleRate);
    const attackSamples = Math.max(1, Math.floor(0.015 * sampleRate));

    for (let i = 0; i < noteSamples; i += 1) {
      const idx = startIdx + i;
      if (idx >= totalSamples) break;
      const t = i / sampleRate;
      const attack = i < attackSamples ? i / attackSamples : 1;
      const decay = Math.exp((-6.5 * i) / noteSamples);
      const main = Math.sin(2 * Math.PI * note.freq * t) * 0.24;
      const overtone =
        i < noteSamples * 0.6
          ? Math.sin(2 * Math.PI * (note.freq * 2) * t) * 0.055 * Math.exp((-9.0 * i) / noteSamples)
          : 0;
      samples[idx] += (main + overtone) * attack * decay;
    }
  }

  for (let i = 0; i < totalSamples; i += 1) {
    samples[i] = Math.max(-0.95, Math.min(0.95, samples[i] * 1.15));
  }

  cachedAlarmChimeUrl = encodeMonoWavBlobUrl(samples, sampleRate);
  return cachedAlarmChimeUrl;
}

function getSharedAlarmAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!sharedAlarmAudioEl) {
    const el = new Audio();
    el.preload = 'auto';
    el.setAttribute('playsinline', 'true');
    sharedAlarmAudioEl = el;
  }
  return sharedAlarmAudioEl;
}

function updateMediaSession(
  playbackState: 'none' | 'playing' | 'paused',
  meta?: { title: string; subtitle?: string }
): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    const ms = navigator.mediaSession;
    if (meta && typeof MediaMetadata !== 'undefined') {
      ms.metadata = new MediaMetadata({
        title: meta.title,
        artist: meta.subtitle || '수현·다현 학습 매니저',
        album: '유튜브 알림 타이머'
      });
    }
    ms.playbackState = playbackState;
  } catch {
    // Ignore unsupported MediaSession operations
  }
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
 * Unlocks Web Audio and primes the shared HTML5 Audio element synchronously inside a user click gesture
 * so mobile browsers allow chime playback even when the tab moves to the background.
 */
export function unlockAlarmAudio(): void {
  const ctx = getAudioContext();
  if (ctx) {
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
      // Ignore Web Audio unlock failures
    }
  }

  const audioEl = getSharedAlarmAudioElement();
  if (audioEl && mediaMode === 'idle') {
    try {
      audioEl.src = getSilentKeepAliveWavUrl();
      audioEl.loop = true;
      audioEl.volume = 0.01;
      const playPromise = audioEl.play();
      if (playPromise && typeof playPromise.then === 'function') {
        void playPromise
          .then(() => {
            if (mediaMode === 'idle') {
              audioEl.pause();
            }
          })
          .catch(() => {
            // Ignore autoplay prime failure
          });
      }
    } catch {
      // Ignore HTMLAudio unlock failures
    }
  }
}

export function startBackgroundTimerKeepAlive(meta?: {
  title: string;
  subtitle?: string;
}): void {
  const audioEl = getSharedAlarmAudioElement();
  mediaMode = 'keepalive';
  updateMediaSession(
    'playing',
    meta || { title: '유튜브 타이머 실행 중', subtitle: '수현·다현 학습 매니저' }
  );

  if (!audioEl) return;
  try {
    const silentUrl = getSilentKeepAliveWavUrl();
    if (audioEl.src !== silentUrl) {
      audioEl.src = silentUrl;
    }
    audioEl.loop = true;
    audioEl.volume = 0.01;
    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      void playPromise.catch(() => {
        // Ignore keepalive play rejection
      });
    }
  } catch {
    // Ignore keepalive errors
  }
}

export function stopBackgroundTimerKeepAlive(): void {
  if (mediaMode !== 'keepalive') return;
  mediaMode = 'idle';
  if (sharedAlarmAudioEl) {
    try {
      sharedAlarmAudioEl.pause();
    } catch {
      // Ignore pause error
    }
  }
  updateMediaSession('none');
}

export function forceStopAllAlarmAudio(): void {
  mediaMode = 'idle';
  if (sharedAlarmAudioEl) {
    try {
      sharedAlarmAudioEl.pause();
      sharedAlarmAudioEl.currentTime = 0;
    } catch {
      // Ignore stop error
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(0);
    } catch {
      // Ignore vibrate stop error
    }
  }
  updateMediaSession('none');
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

  if (mediaMode === 'idle') {
    const audioEl = getSharedAlarmAudioElement();
    if (audioEl) {
      try {
        audioEl.src = getAlarmChimeWavUrl();
        audioEl.loop = false;
        audioEl.volume = 0.9;
        audioEl.currentTime = 0;
        const p = audioEl.play();
        if (p && typeof p.catch === 'function') {
          void p.catch(() => {
            // Web Audio melody already triggered
          });
        }
      } catch {
        // Ignore test fallback errors
      }
    }
  }
}

export function startContinuousAlarmSound(
  shouldContinue: () => boolean,
  options?: { title?: string; body?: string }
): () => void {
  let stopped = false;
  let webAudioIntervalId: ReturnType<typeof setInterval> | null = null;

  const triggerWebAudioFallback = () => {
    if (stopped || webAudioIntervalId !== null) return;
    playAlarmMelody();
    webAudioIntervalId = setInterval(() => {
      if (stopped || !shouldContinue()) {
        if (webAudioIntervalId !== null) {
          clearInterval(webAudioIntervalId);
          webAudioIntervalId = null;
        }
        return;
      }
      playAlarmMelody();
    }, 2200);
  };

  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([300, 150, 300, 150, 400]);
      } catch {
        // Ignore vibrate failure
      }
    }
  };

  mediaMode = 'alarm';
  updateMediaSession('playing', {
    title: options?.title || '유튜브 시청 시간 종료!',
    subtitle: options?.body || '알림 해제를 눌러주세요'
  });

  const audioEl = getSharedAlarmAudioElement();
  if (audioEl) {
    try {
      audioEl.src = getAlarmChimeWavUrl();
      audioEl.loop = true;
      audioEl.volume = 1.0;
      audioEl.currentTime = 0;
      const playPromise = audioEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        void playPromise.catch(() => {
          triggerWebAudioFallback();
        });
      }
    } catch {
      triggerWebAudioFallback();
    }
  } else {
    triggerWebAudioFallback();
  }

  triggerVibration();
  const guardIntervalId = setInterval(() => {
    if (stopped) return;
    if (!shouldContinue()) {
      stopped = true;
      clearInterval(guardIntervalId);
      if (webAudioIntervalId !== null) {
        clearInterval(webAudioIntervalId);
        webAudioIntervalId = null;
      }
      if (mediaMode === 'alarm') {
        mediaMode = 'idle';
        if (sharedAlarmAudioEl) {
          try {
            sharedAlarmAudioEl.pause();
            sharedAlarmAudioEl.currentTime = 0;
          } catch {
            // Ignore pause error
          }
        }
        updateMediaSession('none');
      }
      return;
    }

    triggerVibration();
    if (audioEl && mediaMode === 'alarm' && audioEl.paused) {
      const p = audioEl.play();
      if (p && typeof p.catch === 'function') {
        void p.catch(() => {
          triggerWebAudioFallback();
        });
      }
    }
  }, 2200);

  return () => {
    stopped = true;
    clearInterval(guardIntervalId);
    if (webAudioIntervalId !== null) {
      clearInterval(webAudioIntervalId);
      webAudioIntervalId = null;
    }
    if (mediaMode === 'alarm') {
      mediaMode = 'idle';
      if (sharedAlarmAudioEl) {
        try {
          sharedAlarmAudioEl.pause();
          sharedAlarmAudioEl.currentTime = 0;
        } catch {
          // Ignore pause error
        }
      }
      updateMediaSession('none');
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore vibrate clear failure
      }
    }
  };
}

/**
 * Runs a periodic callback inside an inline Web Worker so background tabs are far less throttled,
 * plus immediately fires on visibilitychange when the page becomes visible again.
 */
export function startBackgroundTicker(onTick: () => void, intervalMs = 500): () => void {
  let disposed = false;
  let worker: Worker | null = null;
  let workerBlobUrl: string | null = null;
  let fallbackInterval: ReturnType<typeof setInterval> | null = null;

  const safeTick = () => {
    if (!disposed) {
      onTick();
    }
  };

  if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      const workerCode = `
        const ms = ${Math.max(100, Math.round(intervalMs))};
        setInterval(() => { self.postMessage('tick'); }, ms);
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      workerBlobUrl = URL.createObjectURL(blob);
      worker = new Worker(workerBlobUrl);
      worker.onmessage = safeTick;
      worker.onerror = () => {
        if (fallbackInterval === null && !disposed) {
          fallbackInterval = setInterval(safeTick, intervalMs);
        }
      };
    } catch {
      fallbackInterval = setInterval(safeTick, intervalMs);
    }
  } else {
    fallbackInterval = setInterval(safeTick, intervalMs);
  }

  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      safeTick();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  return () => {
    disposed = true;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
    if (worker) {
      try {
        worker.terminate();
      } catch {
        // Ignore terminate error
      }
      worker = null;
    }
    if (workerBlobUrl) {
      URL.revokeObjectURL(workerBlobUrl);
      workerBlobUrl = null;
    }
    if (fallbackInterval !== null) {
      clearInterval(fallbackInterval);
      fallbackInterval = null;
    }
  };
}

export async function registerAlarmServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    // Ignore service worker registration errors (e.g., unsupported context)
  }
}

export function getAlarmNotificationPermission(): AlarmNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestAlarmNotificationPermission(): Promise<AlarmNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission !== 'default') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function sendTimerCompleteNotification(
  title: string,
  body: string,
  tag = 'youtube-timer-alarm'
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body,
    tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 400]
  };

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, options);
        return;
      }
    } catch {
      // Fall back to direct Notification constructor
    }
  }

  try {
    const notif = new Notification(title, options);
    notif.onclick = () => {
      try {
        window.focus();
        notif.close();
      } catch {
        // Ignore focus error
      }
    };
  } catch {
    // Direct Notification constructor may fail on some mobile browsers without SW
  }
}

export async function closeTimerCompleteNotifications(tag?: string): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration || typeof registration.getNotifications !== 'function') return;
    const notifications = await registration.getNotifications(tag ? { tag } : undefined);
    notifications.forEach((n) => n.close());
  } catch {
    // Ignore notification close errors
  }
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
