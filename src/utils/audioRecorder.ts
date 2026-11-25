import { AuthRole, ChildKey, DayKey, ReadingRecordingMeta } from '../types';

export interface StoredAudioBlob {
  audioId: string;
  mimeType: string;
  dataBase64: string;
  durationSec: number;
  recordedAt: number;
}

const LOCAL_AUDIO_PREFIX = 'suhyun_dahyun_audio_v4:';
const memoryAudioCache = new Map<string, StoredAudioBlob>();

export function pickSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ];
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    } catch {
      // Ignore probe error
    }
  }
  return '';
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Failed to encode audio blob'));
        return;
      }
      resolve(result.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlobUrl(dataBase64: string, mimeType: string): string {
  const binary = atob(dataBase64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType || 'audio/webm' });
  return URL.createObjectURL(blob);
}

export function saveLocalAudioBlob(blobData: StoredAudioBlob): void {
  memoryAudioCache.set(blobData.audioId, blobData);
  try {
    localStorage.setItem(`${LOCAL_AUDIO_PREFIX}${blobData.audioId}`, JSON.stringify(blobData));
  } catch {
    // localStorage quota may be exceeded for very long recordings; memory cache still works
  }
}

export function loadLocalAudioBlob(audioId: string): StoredAudioBlob | null {
  const cached = memoryAudioCache.get(audioId);
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(`${LOCAL_AUDIO_PREFIX}${audioId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAudioBlob;
    if (parsed?.dataBase64) {
      memoryAudioCache.set(audioId, parsed);
      return parsed;
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

export async function uploadReadingAudio(params: {
  childKey: ChildKey;
  weekId: string;
  dayKey: DayKey;
  audioId: string;
  mimeType: string;
  dataBase64: string;
  durationSec: number;
  authRole: AuthRole;
  pin: string;
  clientSessionId: string | null;
}): Promise<{
  ok: boolean;
  configured: boolean;
  sessionReplaced?: boolean;
  recording?: ReadingRecordingMeta;
  updatedAt?: number;
  error?: string;
}> {
  const localBlob: StoredAudioBlob = {
    audioId: params.audioId,
    mimeType: params.mimeType,
    dataBase64: params.dataBase64,
    durationSec: params.durationSec,
    recordedAt: Date.now()
  };
  saveLocalAudioBlob(localBlob);

  const response = await fetch('/api/audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    cache: 'no-store'
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {
      ok: true,
      configured: false,
      recording: {
        audioId: params.audioId,
        mimeType: params.mimeType,
        durationSec: params.durationSec,
        recordedAt: localBlob.recordedAt
      }
    };
  }

  const data = (await response.json()) as {
    ok: boolean;
    configured: boolean;
    sessionReplaced?: boolean;
    recording?: ReadingRecordingMeta;
    updatedAt?: number;
    error?: string;
  };

  if (!data.configured) {
    return {
      ok: true,
      configured: false,
      recording: {
        audioId: params.audioId,
        mimeType: params.mimeType,
        durationSec: params.durationSec,
        recordedAt: localBlob.recordedAt
      }
    };
  }

  return data;
}

export async function fetchReadingAudio(audioId: string): Promise<StoredAudioBlob | null> {
  const local = loadLocalAudioBlob(audioId);
  if (local) return local;

  const response = await fetch(`/api/audio?id=${encodeURIComponent(audioId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  const data = (await response.json()) as {
    ok: boolean;
    audio?: StoredAudioBlob;
  };
  if (!response.ok || !data.ok || !data.audio?.dataBase64) {
    return null;
  }

  memoryAudioCache.set(audioId, data.audio);
  return data.audio;
}
