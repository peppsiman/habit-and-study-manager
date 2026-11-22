import {
  ChildKey,
  ChildTimerState,
  CloudAppState,
  CloudStateApiResponse,
  SaveCloudStateOptions,
  TimersMap
} from '../types';

export function createParentSessionId(): string {
  return `ps_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function detectDeviceLabel(): string {
  if (typeof navigator === 'undefined') return '웹 기기';
  const ua = navigator.userAgent || '';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  return '웹 기기';
}

export const DEFAULT_TIMER_MINUTES = 20;

function clampTimerMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_TIMER_MINUTES;
  return Math.min(180, Math.max(1, Math.round(minutes)));
}

export function createDefaultChildTimer(targetMinutes = DEFAULT_TIMER_MINUTES): ChildTimerState {
  const mins = clampTimerMinutes(targetMinutes);
  const totalSec = mins * 60;
  return {
    targetMinutes: mins,
    remainingSeconds: totalSec,
    baseRemainingSeconds: totalSec,
    isRunning: false,
    startedAt: null,
    isAlarmRinging: false
  };
}

function hydrateSingleTimer(raw: unknown): ChildTimerState {
  if (!raw || typeof raw !== 'object') {
    return createDefaultChildTimer(DEFAULT_TIMER_MINUTES);
  }

  const obj = raw as Partial<ChildTimerState>;
  if (typeof obj.targetMinutes !== 'number' || !Number.isFinite(obj.targetMinutes) || obj.targetMinutes <= 0) {
    return createDefaultChildTimer(DEFAULT_TIMER_MINUTES);
  }

  const targetMinutes = clampTimerMinutes(obj.targetMinutes);
  const maxSeconds = targetMinutes * 60;

  if (obj.isAlarmRinging === true) {
    return {
      targetMinutes,
      remainingSeconds: 0,
      baseRemainingSeconds: 0,
      isRunning: false,
      startedAt: null,
      isAlarmRinging: true
    };
  }

  const isRunning = Boolean(obj.isRunning);
  const startedAt =
    typeof obj.startedAt === 'number' && Number.isFinite(obj.startedAt) && obj.startedAt > 0
      ? obj.startedAt
      : null;

  if (isRunning && startedAt !== null) {
    const baseRemaining =
      typeof obj.baseRemainingSeconds === 'number' && Number.isFinite(obj.baseRemainingSeconds)
        ? Math.min(maxSeconds, Math.max(0, obj.baseRemainingSeconds))
        : typeof obj.remainingSeconds === 'number' && Number.isFinite(obj.remainingSeconds)
        ? Math.min(maxSeconds, Math.max(0, obj.remainingSeconds))
        : maxSeconds;
    const elapsedSinceStart = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const rem = Math.max(0, baseRemaining - elapsedSinceStart);

    if (rem === 0) {
      return {
        targetMinutes,
        remainingSeconds: 0,
        baseRemainingSeconds: 0,
        isRunning: false,
        startedAt: null,
        isAlarmRinging: true
      };
    }

    return {
      targetMinutes,
      remainingSeconds: rem,
      baseRemainingSeconds: baseRemaining,
      isRunning: true,
      startedAt,
      isAlarmRinging: false
    };
  }

  const rawRemaining =
    typeof obj.remainingSeconds === 'number' && Number.isFinite(obj.remainingSeconds)
      ? Math.min(maxSeconds, Math.max(0, Math.round(obj.remainingSeconds)))
      : maxSeconds;

  return {
    targetMinutes,
    remainingSeconds: rawRemaining,
    baseRemainingSeconds: rawRemaining,
    isRunning: false,
    startedAt: null,
    isAlarmRinging: false
  };
}

export function hydrateTimers(rawTimers: unknown): TimersMap {
  const rawObj = (rawTimers && typeof rawTimers === 'object' ? rawTimers : {}) as Partial<
    Record<ChildKey, unknown>
  >;

  return {
    suhyun: hydrateSingleTimer(rawObj.suhyun),
    dahyun: hydrateSingleTimer(rawObj.dahyun)
  };
}

export function computeTimerRemaining(timer: ChildTimerState, now = Date.now()): number {
  if (!timer.isRunning) {
    return Math.max(0, timer.remainingSeconds || 0);
  }
  if (typeof timer.startedAt === 'number' && timer.startedAt > 0) {
    const base = Math.max(0, timer.baseRemainingSeconds ?? timer.targetMinutes * 60);
    return Math.max(0, base - Math.max(0, Math.floor((now - timer.startedAt) / 1000)));
  }
  return Math.max(0, (timer.remainingSeconds || 0) - 1);
}

export async function fetchCloudState(): Promise<CloudStateApiResponse> {
  const response = await fetch('/api/state', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      configured: false,
      storageType: 'none',
      state: null,
      error: `Unexpected content-type (${response.status})`
    };
  }

  const data = (await response.json()) as CloudStateApiResponse;
  if (!response.ok && !data.error) {
    return {
      ...data,
      ok: false,
      error: `HTTP ${response.status}`
    };
  }

  return data;
}

export async function saveCloudState(
  state: CloudAppState,
  options?: SaveCloudStateOptions
): Promise<CloudStateApiResponse> {
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...state,
      ...(options || {})
    }),
    cache: 'no-store'
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      configured: false,
      storageType: 'none',
      state: null,
      error: `Unexpected content-type (${response.status})`
    };
  }

  const data = (await response.json()) as CloudStateApiResponse;
  if (!response.ok && !data.error) {
    return {
      ...data,
      ok: false,
      error: `HTTP ${response.status}`
    };
  }

  return data;
}
