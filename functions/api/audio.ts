interface KVNamespace {
  get(key: string, type: 'text'): Promise<string | null>;
  get<T = unknown>(key: string, type: 'json'): Promise<T | null>;
  put(key: string, value: string): Promise<void>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}

interface Env {
  KIDS_EDU_KV?: KVNamespace;
  KV?: KVNamespace;
  APP_KV?: KVNamespace;
  KIDS_EDU_DB?: D1Database;
  DB?: D1Database;
}

interface EventContext<E> {
  request: Request;
  env: E;
}

type PagesFunction<E = unknown> = (context: EventContext<E>) => Response | Promise<Response>;

const STATE_KEY = 'kids_edu_app_state_v3';
const AUDIO_KEY_PREFIX = 'kids_edu_audio:';
const VALID_DAYS = new Set(['MON', 'TUE', 'WED', 'THU', 'FRI']);

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate'
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: BASE_HEADERS
  });
}

function getKvBinding(env: Env): KVNamespace | undefined {
  return env.KIDS_EDU_KV || env.KV || env.APP_KV;
}

function getD1Binding(env: Env): D1Database | undefined {
  return env.KIDS_EDU_DB || env.DB;
}

async function ensureD1Tables(db: D1Database): Promise<void> {
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)'
    )
    .run();
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS audio_blobs (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL)'
    )
    .run();
}

function extractSessionId(stateObj: Record<string, unknown> | null): string | null {
  if (!stateObj || typeof stateObj !== 'object') return null;
  const session = stateObj.activeParentSession;
  if (!session || typeof session !== 'object') return null;
  const sessionId = (session as Record<string, unknown>).sessionId;
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : null;
}

function isValidAudioId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{4,100}$/.test(id);
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...BASE_HEADERS,
        Allow: 'GET, POST, OPTIONS'
      }
    });
  }

  const kv = getKvBinding(env);
  const db = getD1Binding(env);

  if (!kv && !db) {
    return jsonResponse({
      ok: false,
      configured: false,
      storageType: 'none',
      error: 'Cloud storage is not bound.'
    });
  }

  const storageType = kv ? 'kv' : 'd1';

  try {
    if (method === 'GET') {
      const url = new URL(request.url);
      const audioId = (url.searchParams.get('id') || '').trim();
      if (!isValidAudioId(audioId)) {
        return jsonResponse(
          { ok: false, configured: true, storageType, error: 'Invalid audio id.' },
          400
        );
      }

      if (kv) {
        const audio = await kv.get(`${AUDIO_KEY_PREFIX}${audioId}`, 'json');
        if (!audio) {
          return jsonResponse(
            { ok: false, configured: true, storageType, error: 'Audio not found.' },
            404
          );
        }
        return jsonResponse({ ok: true, configured: true, storageType, audio });
      }

      if (db) {
        await ensureD1Tables(db);
        const row = await db
          .prepare('SELECT payload FROM audio_blobs WHERE id = ?1')
          .bind(audioId)
          .first<{ payload: string }>();
        if (!row?.payload) {
          return jsonResponse(
            { ok: false, configured: true, storageType, error: 'Audio not found.' },
            404
          );
        }
        return jsonResponse({
          ok: true,
          configured: true,
          storageType,
          audio: JSON.parse(row.payload)
        });
      }
    }

    if (method === 'POST') {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') {
        return jsonResponse(
          { ok: false, configured: true, storageType, error: 'Invalid JSON body.' },
          400
        );
      }

      const childKey = body.childKey === 'suhyun' || body.childKey === 'dahyun' ? body.childKey : null;
      const weekId = typeof body.weekId === 'string' ? body.weekId.trim() : '';
      const dayKey = typeof body.dayKey === 'string' ? body.dayKey.trim() : '';
      const audioId = typeof body.audioId === 'string' ? body.audioId.trim() : '';
      const mimeType =
        typeof body.mimeType === 'string' && body.mimeType.trim()
          ? body.mimeType.trim()
          : 'audio/webm';
      const dataBase64 = typeof body.dataBase64 === 'string' ? body.dataBase64.trim() : '';
      const durationSec =
        typeof body.durationSec === 'number' && Number.isFinite(body.durationSec)
          ? Math.max(1, Math.round(body.durationSec))
          : 1;
      const authRole = body.authRole;
      const pin = typeof body.pin === 'string' ? body.pin : '';
      const clientSessionId =
        typeof body.clientSessionId === 'string' && body.clientSessionId.trim()
          ? body.clientSessionId.trim()
          : null;

      if (
        !childKey ||
        !/^\d{4}-\d{2}-\d{2}$/.test(weekId) ||
        !VALID_DAYS.has(dayKey) ||
        !isValidAudioId(audioId) ||
        !dataBase64 ||
        dataBase64.length > 6_000_000
      ) {
        return jsonResponse(
          { ok: false, configured: true, storageType, error: 'Invalid audio upload payload.' },
          400
        );
      }

      if (db) {
        await ensureD1Tables(db);
      }

      let existing: Record<string, unknown> | null = null;
      if (kv) {
        existing = await kv.get<Record<string, unknown>>(STATE_KEY, 'json');
      } else if (db) {
        const row = await db
          .prepare('SELECT payload FROM app_state WHERE id = ?1')
          .bind(STATE_KEY)
          .first<{ payload: string }>();
        if (row?.payload) {
          existing = JSON.parse(row.payload) as Record<string, unknown>;
        }
      }

      const existingSessionId = extractSessionId(existing);
      const existingParentPin =
        typeof existing?.parentPin === 'string' && existing.parentPin.trim().length >= 4
          ? existing.parentPin.trim()
          : '1234';

      if (authRole === 'parent') {
        if (existingSessionId) {
          if (!clientSessionId || clientSessionId !== existingSessionId) {
            return jsonResponse(
              {
                ok: false,
                configured: true,
                storageType,
                sessionReplaced: true,
                error: 'Active parent session belongs to another device.'
              },
              403
            );
          }
        } else if (pin !== existingParentPin) {
          return jsonResponse(
            { ok: false, configured: true, storageType, error: 'Parent authentication failed.' },
            403
          );
        }
      } else if (authRole === 'suhyun' || authRole === 'dahyun') {
        if (authRole !== childKey) {
          return jsonResponse(
            { ok: false, configured: true, storageType, error: 'Cannot upload for sibling.' },
            403
          );
        }
        const defaultChildPin = childKey === 'suhyun' ? '8864' : '7749';
        const childPins = (existing?.childPins || {}) as Record<string, unknown>;
        const expectedPin =
          typeof childPins[childKey] === 'string' && String(childPins[childKey]).trim().length >= 4
            ? String(childPins[childKey]).trim()
            : defaultChildPin;
        if (pin !== expectedPin) {
          return jsonResponse(
            { ok: false, configured: true, storageType, error: 'Child authentication failed.' },
            403
          );
        }
      } else {
        return jsonResponse(
          { ok: false, configured: true, storageType, error: 'Authentication required.' },
          403
        );
      }

      const recordedAt = Date.now();
      const audioBlobPayload = {
        audioId,
        mimeType,
        dataBase64,
        durationSec,
        recordedAt
      };
      const serializedAudio = JSON.stringify(audioBlobPayload);

      if (kv) {
        await kv.put(`${AUDIO_KEY_PREFIX}${audioId}`, serializedAudio);
      } else if (db) {
        await db
          .prepare(
            'INSERT INTO audio_blobs (id, payload, created_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at'
          )
          .bind(audioId, serializedAudio, recordedAt)
          .run();
      }

      const recordingMeta = {
        audioId,
        mimeType,
        durationSec,
        recordedAt
      };

      let nextUpdatedAt = recordedAt;
      if (existing && typeof existing === 'object' && existing.childrenData && typeof existing.childrenData === 'object') {
        const childrenData = { ...(existing.childrenData as Record<string, Record<string, unknown>>) };
        const childObj = { ...(childrenData[childKey] || {}) };
        const weeks = { ...((childObj.weeks as Record<string, Record<string, unknown>>) || {}) };
        const weekObj = {
          ...(weeks[weekId] || {
            weekId,
            checks: {},
            earnedScores: {},
            readingRecordings: {},
            clothesSubChecks: {},
            usedYoutubeMinutes: 0,
            youtubeLogs: []
          })
        };
        const readingRecordings = {
          ...((weekObj.readingRecordings as Record<string, unknown>) || {}),
          [dayKey]: recordingMeta
        };
        weekObj.readingRecordings = readingRecordings;
        weeks[weekId] = weekObj;
        childObj.weeks = weeks;
        childrenData[childKey] = childObj;

        const prevUpdated =
          typeof existing.updatedAt === 'number' && Number.isFinite(existing.updatedAt)
            ? existing.updatedAt
            : 0;
        nextUpdatedAt = Math.max(recordedAt, prevUpdated + 1);

        const updatedState = {
          ...existing,
          updatedAt: nextUpdatedAt,
          childrenData
        };
        const serializedState = JSON.stringify(updatedState);

        if (kv) {
          await kv.put(STATE_KEY, serializedState);
        } else if (db) {
          await db
            .prepare(
              'INSERT INTO app_state (id, payload, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at'
            )
            .bind(STATE_KEY, serializedState, nextUpdatedAt)
            .run();
        }
      }

      return jsonResponse({
        ok: true,
        configured: true,
        storageType,
        recording: recordingMeta,
        updatedAt: nextUpdatedAt
      });
    }

    return jsonResponse(
      { ok: false, configured: true, storageType, error: `Method ${method} not allowed` },
      405
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected audio storage error';
    return jsonResponse(
      { ok: false, configured: true, storageType, error: message },
      500
    );
  }
};
