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

  try {
    if (method === 'GET') {
      if (kv) {
        const stored = await kv.get(STATE_KEY, 'json');
        return jsonResponse({
          ok: true,
          configured: true,
          storageType: 'kv',
          state: stored || null
        });
      }

      if (db) {
        await ensureD1Table(db);
        const row = await db
          .prepare('SELECT payload FROM app_state WHERE id = ?1')
          .bind(STATE_KEY)
          .first<{ payload: string }>();

        let parsed: unknown = null;
        if (row?.payload) {
          parsed = JSON.parse(row.payload);
        }

        return jsonResponse({
          ok: true,
          configured: true,
          storageType: 'd1',
          state: parsed
        });
      }
    }

    if (method === 'PUT' || method === 'POST') {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== 'object' || !body.childrenData || typeof body.childrenData !== 'object') {
        return jsonResponse(
          {
            ok: false,
            configured: true,
            storageType: kv ? 'kv' : 'd1',
            state: null,
            error: 'Invalid payload: childrenData is required.'
          },
          400
        );
      }

      const updatedAt =
        typeof body.updatedAt === 'number' && Number.isFinite(body.updatedAt)
          ? body.updatedAt
          : Date.now();

      const payload = {
        ...body,
        version: typeof body.version === 'number' ? body.version : 3,
        updatedAt
      };

      const serialized = JSON.stringify(payload);

      if (kv) {
        await kv.put(STATE_KEY, serialized);
        return jsonResponse({
          ok: true,
          configured: true,
          storageType: 'kv',
          state: payload
        });
      }

      if (db) {
        await ensureD1Table(db);
        await db
          .prepare(
            'INSERT INTO app_state (id, payload, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at'
          )
          .bind(STATE_KEY, serialized, updatedAt)
          .run();

        return jsonResponse({
          ok: true,
          configured: true,
          storageType: 'd1',
          state: payload
        });
      }
    }

    return jsonResponse(
      {
        ok: false,
        configured: true,
        storageType: kv ? 'kv' : 'd1',
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
        storageType: kv ? 'kv' : 'd1',
        state: null,
        error: message
      },
      500
    );
  }
};
