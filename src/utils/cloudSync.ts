import {
  ChildKey,
  ChildTimerState,
  CloudAppState,
  CloudStateApiResponse,
  TimersMap
} from '../types';

function hydrateSingleTimer(raw: unknown): ChildTimerState {
  if (!raw || typeof raw !== 'object') {
    return {
      isRunning: false,
      elapsedSeconds: 0,
      baseElapsedSeconds: 0,
      startedAt: null
    };
  }

  const obj = raw as Partial<ChildTimerState>;
  const isRunning = Boolean(obj.isRunning);
  const rawElapsed = Math.max(0, Number(obj.elapsedSeconds) || 0);
  const rawBase =
    typeof obj.baseElapsedSeconds === 'number' && Number.isFinite(obj.baseElapsedSeconds)
      ? Math.max(0, obj.baseElapsedSeconds)
      : rawElapsed;
  const startedAt =
    typeof obj.startedAt === 'number' && Number.isFinite(obj.startedAt) && obj.startedAt > 0
      ? obj.startedAt
      : null;

  if (isRunning && startedAt !== null) {
    const delta = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    return {
      isRunning: true,
      elapsedSeconds: rawBase + delta,
      baseElapsedSeconds: rawBase,
      startedAt
    };
  }

  return {
    isRunning: false,
    elapsedSeconds: rawElapsed,
    baseElapsedSeconds: rawElapsed,
    startedAt: null
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

export function computeTimerElapsed(timer: ChildTimerState, now = Date.now()): number {
  if (!timer.isRunning) {
    return Math.max(0, timer.elapsedSeconds || 0);
  }
  if (typeof timer.startedAt === 'number' && timer.startedAt > 0) {
    const base = Math.max(0, timer.baseElapsedSeconds ?? 0);
    return base + Math.max(0, Math.floor((now - timer.startedAt) / 1000));
  }
  return Math.max(0, (timer.elapsedSeconds || 0) + 1);
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

export async function saveCloudState(state: CloudAppState): Promise<CloudStateApiResponse> {
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
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
