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
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

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

async function ensureD1Table(db: D1Database): Promise<void> {
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)'
    )
    .run();
}

async function readExistingD1State(db: D1Database): Promise<Record<string, unknown> | null> {
  await ensureD1Table(db);
  const row = await db
    .prepare('SELECT payload FROM app_state WHERE id = ?1')
    .bind(STATE_KEY)
    .first<{ payload: string }>();

  if (!row?.payload) return null;
  const parsed = JSON.parse(row.payload);
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
}

function extractSessionId(stateObj: Record<string, unknown> | null): string | null {
  if (!stateObj || typeof stateObj !== 'object') return null;
  const session = stateObj.activeParentSession;
  if (!session || typeof session !== 'object') return null;
  const sessionId = (session as Record<string, unknown>).sessionId;
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : null;
}

function isParentSessionExpired(session: unknown, now = Date.now()): boolean {
  if (!session || typeof session !== 'object') return true;
  const s = session as Record<string, unknown>;
  const lastActive =
    typeof s.lastActiveAt === 'number' && Number.isFinite(s.lastActiveAt) && s.lastActiveAt > 0
      ? s.lastActiveAt
      : typeof s.loggedInAt === 'number' && Number.isFinite(s.loggedInAt) && s.loggedInAt > 0
      ? s.loggedInAt
      : 0;
  if (!lastActive) return true;
  return now - lastActive >= SESSION_IDLE_TIMEOUT_MS;
}

function sanitizeExpiredSessionForRead(
  stored: Record<string, unknown> | null,
  now = Date.now()
): { state: Record<string, unknown> | null; expiredSessionId: string | null } {
  if (!stored || typeof stored !== 'object') {
    return { state: stored, expiredSessionId: null };
  }
  const existingSessionId = extractSessionId(stored);
  if (existingSessionId && isParentSessionExpired(stored.activeParentSession, now)) {
    return {
      state: { ...stored, activeParentSession: null },
      expiredSessionId: existingSessionId
    };
  }
  return { state: stored, expiredSessionId: null };
}

async function persistState(
  kv: KVNamespace | undefined,
  db: D1Database | undefined,
  stateObj: Record<string, unknown>,
  updatedAt: number
): Promise<void> {
  const serialized = JSON.stringify(stateObj);
  if (kv) {
    await kv.put(STATE_KEY, serialized);
    return;
  }
  if (db) {
    await ensureD1Table(db);
    await db
      .prepare(
        'INSERT INTO app_state (id, payload, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at'
      )
      .bind(STATE_KEY, serialized, updatedAt)
      .run();
  }
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...BASE_HEADERS,
        Allow: 'GET, PUT, POST, OPTIONS'
      }
    });
  }

  const kv = getKvBinding(env);
  const db = getD1Binding(env);

  if (!kv && !db) {
    return jsonResponse({
      ok: true,
      configured: false,
      storageType: 'none',
      state: null
    });
  }

  const storageType = kv ? 'kv' : 'd1';

  try {
    if (method === 'GET') {
      const stored = kv
        ? await kv.get<Record<string, unknown>>(STATE_KEY, 'json')
        : db
        ? await readExistingD1State(db)
        : null;
      const { state, expiredSessionId } = sanitizeExpiredSessionForRead(stored, Date.now());
      return jsonResponse({
        ok: true,
        configured: true,
        storageType,
        state: state || null,
        ...(expiredSessionId ? { expiredSessionId } : {})
      });
    }

    if (method === 'PUT' || method === 'POST') {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') {
        return jsonResponse(
          {
            ok: false,
            configured: true,
            storageType,
            state: null,
            error: 'Invalid JSON body.'
          },
          400
        );
      }

      const clientSessionId =
        typeof body.clientSessionId === 'string' && body.clientSessionId.trim()
          ? body.clientSessionId.trim()
          : null;
      const claimSession = body.claimSession === true;
      const releaseSession = body.releaseSession === true;
      const heartbeatSession = body.heartbeatSession === true;

      const existing = kv
        ? await kv.get<Record<string, unknown>>(STATE_KEY, 'json')
        : db
        ? await readExistingD1State(db)
        : null;
      const existingSessionId = extractSessionId(existing);

      if (heartbeatSession) {
        if (!clientSessionId) {
          return jsonResponse(
            {
              ok: false,
              configured: true,
              storageType,
              state: null,
              error: 'clientSessionId is required for heartbeat.'
            },
            400
          );
        }

        const now = Date.now();
        if (!existing || !existingSessionId) {
          return jsonResponse(
            {
              ok: false,
              configured: true,
              storageType,
              sessionExpired: true,
              state: existing,
              error: 'Active parent session has ended.'
            },
            409
          );
        }

        const existingExpired = isParentSessionExpired(existing.activeParentSession, now);
        if (existingSessionId !== clientSessionId) {
          if (existingExpired) {
            return jsonResponse(
              {
                ok: false,
                configured: true,
                storageType,
                sessionExpired: true,
                state: { ...existing, activeParentSession: null },
                error: 'Active parent session expired due to inactivity.'
              },
              409
            );
          }
          return jsonResponse(
            {
              ok: false,
              configured: true,
              storageType,
              sessionReplaced: true,
              state: existing,
              error: 'Active parent session belongs to another device.'
            },
            409
          );
        }

        const existingUpdatedAt =
          typeof existing.updatedAt === 'number' && Number.isFinite(existing.updatedAt)
            ? existing.updatedAt
            : now;

        if (existingExpired) {
          const clearedExisting = { ...existing, activeParentSession: null };
          await persistState(kv, db, clearedExisting, existingUpdatedAt);
          return jsonResponse(
            {
              ok: false,
              configured: true,
              storageType,
              sessionExpired: true,
              state: clearedExisting,
              error: 'Active parent session expired due to inactivity.'
            },
            409
          );
        }

        const updatedExisting = {
          ...existing,
          activeParentSession: {
            ...(existing.activeParentSession as Record<string, unknown>),
            lastActiveAt: now
          }
        };
        await persistState(kv, db, updatedExisting, existingUpdatedAt);
        return jsonResponse({
          ok: true,
          configured: true,
          storageType,
          state: updatedExisting
        });
      }

      if (!body.childrenData || typeof body.childrenData !== 'object') {
        return jsonResponse(
          {
            ok: false,
            configured: true,
            storageType,
            state: null,
            error: 'Invalid payload: childrenData is required.'
          },
          400
        );
      }

      const {
        clientSessionId: _omitClientSessionId,
        claimSession: _omitClaimSession,
        releaseSession: _omitReleaseSession,
        heartbeatSession: _omitHeartbeatSession,
        ...cleanBody
      } = body;

      const updatedAt =
        typeof cleanBody.updatedAt === 'number' && Number.isFinite(cleanBody.updatedAt)
          ? cleanBody.updatedAt
          : Date.now();

      const payload: Record<string, unknown> = {
        ...cleanBody,
        version: typeof cleanBody.version === 'number' ? cleanBody.version : 3,
        updatedAt
      };

      const serverNow = Date.now();
      const existingExpired = existingSessionId
        ? isParentSessionExpired(existing?.activeParentSession, serverNow)
        : false;

      if (claimSession) {
        const claimedSessionId = extractSessionId(payload);
        if (!claimedSessionId) {
          return jsonResponse(
            {
              ok: false,
              configured: true,
              storageType,
              state: existing,
              error: 'Invalid session claim: activeParentSession.sessionId is required.'
            },
            400
          );
        }
        payload.activeParentSession = {
          ...(payload.activeParentSession as Record<string, unknown>),
          lastActiveAt: serverNow
        };
      } else if (releaseSession) {
        if (existingSessionId && clientSessionId !== existingSessionId && !existingExpired) {
          return jsonResponse(
            {
              ok: false,
              configured: true,
              storageType,
              sessionReplaced: true,
              state: existing,
              error: 'Active parent session belongs to another device.'
            },
            409
          );
        }
        if (
          existing !== null &&
          (!existingSessionId || (clientSessionId !== existingSessionId && existingExpired))
        ) {
          if (existingSessionId && existingExpired) {
            const clearedExisting = { ...existing, activeParentSession: null };
            const existingUpdatedAt =
              typeof existing.updatedAt === 'number' && Number.isFinite(existing.updatedAt)
                ? existing.updatedAt
                : serverNow;
            await persistState(kv, db, clearedExisting, existingUpdatedAt);
            return jsonResponse({
              ok: true,
              configured: true,
              storageType,
              state: clearedExisting
            });
          }
          return jsonResponse({
            ok: true,
            configured: true,
            storageType,
            state: { ...existing, activeParentSession: null }
          });
        }
        payload.activeParentSession = null;
      } else if (existing !== null) {
        if (!existingSessionId) {
          return jsonResponse(
            {
              ok: false,
              configured: true,
              storageType,
              sessionExpired: true,
              state: existing,
              error: 'Active parent session has ended.'
            },
            409
          );
        }
        if (!clientSessionId || clientSessionId !== existingSessionId) {
          if (existingExpired) {
            return jsonResponse(
              {
                ok: false,
                configured: true,
                storageType,
                sessionExpired: true,
                state: { ...existing, activeParentSession: null },
                error: 'Active parent session expired due to inactivity.'
              },
              409
            );
          }
          return jsonResponse(
            {
              ok: false,
              configured: true,
              storageType,
              sessionReplaced: true,
              state: existing,
              error: 'Active parent session required or replaced by another device.'
            },
            409
          );
        }
        if (existingExpired) {
          const clearedExisting = { ...existing, activeParentSession: null };
          const existingUpdatedAt =
            typeof existing.updatedAt === 'number' && Number.isFinite(existing.updatedAt)
              ? existing.updatedAt
              : serverNow;
          await persistState(kv, db, clearedExisting, existingUpdatedAt);
          return jsonResponse(
            {
              ok: false,
              configured: true,
              storageType,
              sessionExpired: true,
              state: clearedExisting,
              error: 'Active parent session expired due to inactivity.'
            },
            409
          );
        }
        payload.activeParentSession = {
          ...(existing.activeParentSession as Record<string, unknown>),
          ...(payload.activeParentSession && typeof payload.activeParentSession === 'object'
            ? (payload.activeParentSession as Record<string, unknown>)
            : {}),
          sessionId: existingSessionId,
          lastActiveAt: serverNow
        };
      }

      await persistState(kv, db, payload, updatedAt);
      return jsonResponse({
        ok: true,
        configured: true,
        storageType,
        state: payload
      });
    }

    return jsonResponse(
      {
        ok: false,
        configured: true,
        storageType,
        state: null,
        error: `Method ${method} not allowed`
      },
      405
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected storage error';
    return jsonResponse(
      {
        ok: false,
        configured: true,
        storageType,
        state: null,
        error: message
      },
      500
    );
  }
};
