import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import {defineConfig} from 'vite';

const LOCAL_STATE_FILE = path.resolve(__dirname, '.wrangler', 'local-kv-state.json');
const LOCAL_AUDIO_DIR = path.resolve(__dirname, '.wrangler', 'audio');
const VALID_AUDIO_DAYS = new Set(['MON', 'TUE', 'WED', 'THU', 'FRI']);
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

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

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.end(JSON.stringify(body));
}

function localCloudStateMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const urlPath = (req.url || '').split('?')[0];
  if (urlPath !== '/api/state') {
    next();
    return;
  }

  const method = (req.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'GET, PUT, POST, OPTIONS');
    res.end();
    return;
  }

  if (method === 'GET') {
    try {
      let stored: Record<string, unknown> | null = null;
      if (fs.existsSync(LOCAL_STATE_FILE)) {
        const raw = fs.readFileSync(LOCAL_STATE_FILE, 'utf8');
        const parsed = raw.trim() ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') {
          stored = parsed as Record<string, unknown>;
        }
      }
      const { state, expiredSessionId } = sanitizeExpiredSessionForRead(stored, Date.now());
      sendJson(res, 200, {
        ok: true,
        configured: true,
        storageType: 'local-file',
        state: state || null,
        ...(expiredSessionId ? { expiredSessionId } : {}),
      });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        configured: true,
        storageType: 'local-file',
        state: null,
        error: err instanceof Error ? err.message : 'Failed to read local state',
      });
    }
    return;
  }

  if (method === 'PUT' || method === 'POST') {
    readRequestBody(req)
      .then((raw) => {
        const body = JSON.parse(raw) as Record<string, unknown>;
        if (!body || typeof body !== 'object') {
          sendJson(res, 400, {
            ok: false,
            configured: true,
            storageType: 'local-file',
            state: null,
            error: 'Invalid JSON body.',
          });
          return;
        }

        const clientSessionId =
          typeof body.clientSessionId === 'string' && body.clientSessionId.trim()
            ? body.clientSessionId.trim()
            : null;
        const claimSession = body.claimSession === true;
        const releaseSession = body.releaseSession === true;
        const heartbeatSession = body.heartbeatSession === true;

        let existing: Record<string, unknown> | null = null;
        if (fs.existsSync(LOCAL_STATE_FILE)) {
          const existingRaw = fs.readFileSync(LOCAL_STATE_FILE, 'utf8');
          const parsed = existingRaw.trim() ? JSON.parse(existingRaw) : null;
          if (parsed && typeof parsed === 'object') {
            existing = parsed as Record<string, unknown>;
          }
        }
        const existingSessionId = extractSessionId(existing);

        const writeLocalState = (stateObj: Record<string, unknown>) => {
          fs.mkdirSync(path.dirname(LOCAL_STATE_FILE), {recursive: true});
          fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(stateObj, null, 2), 'utf8');
        };

        if (heartbeatSession) {
          if (!clientSessionId) {
            sendJson(res, 400, {
              ok: false,
              configured: true,
              storageType: 'local-file',
              state: null,
              error: 'clientSessionId is required for heartbeat.',
            });
            return;
          }

          const now = Date.now();
          if (!existing || !existingSessionId) {
            sendJson(res, 409, {
              ok: false,
              configured: true,
              storageType: 'local-file',
              sessionExpired: true,
              state: existing,
              error: 'Active parent session has ended.',
            });
            return;
          }

          const existingExpired = isParentSessionExpired(existing.activeParentSession, now);
          if (existingSessionId !== clientSessionId) {
            if (existingExpired) {
              sendJson(res, 409, {
                ok: false,
                configured: true,
                storageType: 'local-file',
                sessionExpired: true,
                state: { ...existing, activeParentSession: null },
                error: 'Active parent session expired due to inactivity.',
              });
              return;
            }
            sendJson(res, 409, {
              ok: false,
              configured: true,
              storageType: 'local-file',
              sessionReplaced: true,
              state: existing,
              error: 'Active parent session belongs to another device.',
            });
            return;
          }

          if (existingExpired) {
            const clearedExisting = { ...existing, activeParentSession: null };
            writeLocalState(clearedExisting);
            sendJson(res, 409, {
              ok: false,
              configured: true,
              storageType: 'local-file',
              sessionExpired: true,
              state: clearedExisting,
              error: 'Active parent session expired due to inactivity.',
            });
            return;
          }

          const updatedExisting = {
            ...existing,
            activeParentSession: {
              ...(existing.activeParentSession as Record<string, unknown>),
              lastActiveAt: now,
            },
          };
          writeLocalState(updatedExisting);
          sendJson(res, 200, {
            ok: true,
            configured: true,
            storageType: 'local-file',
            state: updatedExisting,
          });
          return;
        }

        if (!body.childrenData || typeof body.childrenData !== 'object') {
          sendJson(res, 400, {
            ok: false,
            configured: true,
            storageType: 'local-file',
            state: null,
            error: 'Invalid payload: childrenData is required.',
          });
          return;
        }

        const {
          clientSessionId: _omitClientSessionId,
          claimSession: _omitClaimSession,
          releaseSession: _omitReleaseSession,
          heartbeatSession: _omitHeartbeatSession,
          ...cleanBody
        } = body;

        const payload: Record<string, unknown> = {
          ...cleanBody,
          version: typeof cleanBody.version === 'number' ? cleanBody.version : 3,
          updatedAt:
            typeof cleanBody.updatedAt === 'number' && Number.isFinite(cleanBody.updatedAt)
              ? cleanBody.updatedAt
              : Date.now(),
        };

        const serverNow = Date.now();
        const existingExpired = existingSessionId
          ? isParentSessionExpired(existing?.activeParentSession, serverNow)
          : false;

        if (claimSession) {
          if (!extractSessionId(payload)) {
            sendJson(res, 400, {
              ok: false,
              configured: true,
              storageType: 'local-file',
              state: existing,
              error: 'Invalid session claim: activeParentSession.sessionId is required.',
            });
            return;
          }
          payload.activeParentSession = {
            ...(payload.activeParentSession as Record<string, unknown>),
            lastActiveAt: serverNow,
          };
        } else if (releaseSession) {
          if (existingSessionId && clientSessionId !== existingSessionId && !existingExpired) {
            sendJson(res, 409, {
              ok: false,
              configured: true,
              storageType: 'local-file',
              sessionReplaced: true,
              state: existing,
              error: 'Active parent session belongs to another device.',
            });
            return;
          }
          if (
            existing !== null &&
            (!existingSessionId || (clientSessionId !== existingSessionId && existingExpired))
          ) {
            if (existingSessionId && existingExpired) {
              const clearedExisting = { ...existing, activeParentSession: null };
              writeLocalState(clearedExisting);
              sendJson(res, 200, {
                ok: true,
                configured: true,
                storageType: 'local-file',
                state: clearedExisting,
              });
              return;
            }
            sendJson(res, 200, {
              ok: true,
              configured: true,
              storageType: 'local-file',
              state: { ...existing, activeParentSession: null },
            });
            return;
          }
          payload.activeParentSession = null;
        } else if (existing !== null) {
          if (!existingSessionId) {
            sendJson(res, 409, {
              ok: false,
              configured: true,
              storageType: 'local-file',
              sessionExpired: true,
              state: existing,
              error: 'Active parent session has ended.',
            });
            return;
          }
          if (!clientSessionId || clientSessionId !== existingSessionId) {
            if (existingExpired) {
              sendJson(res, 409, {
                ok: false,
                configured: true,
                storageType: 'local-file',
                sessionExpired: true,
                state: { ...existing, activeParentSession: null },
                error: 'Active parent session expired due to inactivity.',
              });
              return;
            }
            sendJson(res, 409, {
              ok: false,
              configured: true,
              storageType: 'local-file',
              sessionReplaced: true,
              state: existing,
              error: 'Active parent session required or replaced by another device.',
            });
            return;
          }
          if (existingExpired) {
            const clearedExisting = { ...existing, activeParentSession: null };
            writeLocalState(clearedExisting);
            sendJson(res, 409, {
              ok: false,
              configured: true,
              storageType: 'local-file',
              sessionExpired: true,
              state: clearedExisting,
              error: 'Active parent session expired due to inactivity.',
            });
            return;
          }
          payload.activeParentSession = {
            ...(existing.activeParentSession as Record<string, unknown>),
            ...(payload.activeParentSession && typeof payload.activeParentSession === 'object'
              ? (payload.activeParentSession as Record<string, unknown>)
              : {}),
            sessionId: existingSessionId,
            lastActiveAt: serverNow,
          };
        }

        writeLocalState(payload);
        sendJson(res, 200, {
          ok: true,
          configured: true,
          storageType: 'local-file',
          state: payload,
        });
      })
      .catch((err) => {
        sendJson(res, 400, {
          ok: false,
          configured: true,
          storageType: 'local-file',
          state: null,
          error: err instanceof Error ? err.message : 'Invalid JSON payload',
        });
      });
    return;
  }

  sendJson(res, 405, {
    ok: false,
    configured: true,
    storageType: 'local-file',
    state: null,
    error: `Method ${method} not allowed`,
  });
}

function localCloudAudioMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const fullUrl = req.url || '';
  const urlPath = fullUrl.split('?')[0];
  if (urlPath !== '/api/audio') {
    next();
    return;
  }

  const method = (req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.end();
    return;
  }

  const isValidAudioId = (id: string) => /^[a-zA-Z0-9_-]{4,100}$/.test(id);

  if (method === 'GET') {
    try {
      const parsedUrl = new URL(fullUrl, 'http://localhost');
      const audioId = (parsedUrl.searchParams.get('id') || '').trim();
      if (!isValidAudioId(audioId)) {
        sendJson(res, 400, { ok: false, configured: true, storageType: 'local-file', error: 'Invalid audio id.' });
        return;
      }
      const audioFile = path.join(LOCAL_AUDIO_DIR, `${audioId}.json`);
      if (!fs.existsSync(audioFile)) {
        sendJson(res, 404, { ok: false, configured: true, storageType: 'local-file', error: 'Audio not found.' });
        return;
      }
      const audio = JSON.parse(fs.readFileSync(audioFile, 'utf8'));
      sendJson(res, 200, { ok: true, configured: true, storageType: 'local-file', audio });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        configured: true,
        storageType: 'local-file',
        error: err instanceof Error ? err.message : 'Failed to read audio',
      });
    }
    return;
  }

  if (method === 'POST') {
    readRequestBody(req)
      .then((raw) => {
        const body = JSON.parse(raw) as Record<string, unknown>;
        const childKey = body.childKey === 'suhyun' || body.childKey === 'dahyun' ? body.childKey : null;
        const weekId = typeof body.weekId === 'string' ? body.weekId.trim() : '';
        const dayKey = typeof body.dayKey === 'string' ? body.dayKey.trim() : '';
        const audioId = typeof body.audioId === 'string' ? body.audioId.trim() : '';
        const mimeType =
          typeof body.mimeType === 'string' && body.mimeType.trim() ? body.mimeType.trim() : 'audio/webm';
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
          !VALID_AUDIO_DAYS.has(dayKey) ||
          !isValidAudioId(audioId) ||
          !dataBase64 ||
          dataBase64.length > 6_000_000
        ) {
          sendJson(res, 400, { ok: false, configured: true, storageType: 'local-file', error: 'Invalid audio upload payload.' });
          return;
        }

        let existing: Record<string, unknown> | null = null;
        if (fs.existsSync(LOCAL_STATE_FILE)) {
          const existingRaw = fs.readFileSync(LOCAL_STATE_FILE, 'utf8');
          const parsed = existingRaw.trim() ? JSON.parse(existingRaw) : null;
          if (parsed && typeof parsed === 'object') existing = parsed as Record<string, unknown>;
        }

        const sessionObj = existing?.activeParentSession as Record<string, unknown> | undefined;
        const existingSessionId =
          sessionObj && typeof sessionObj.sessionId === 'string' && sessionObj.sessionId.trim()
            ? sessionObj.sessionId.trim()
            : null;
        const existingParentPin =
          typeof existing?.parentPin === 'string' && existing.parentPin.trim().length >= 4
            ? existing.parentPin.trim()
            : '1234';

        if (authRole === 'parent') {
          if (existingSessionId) {
            if (isParentSessionExpired(existing?.activeParentSession, Date.now())) {
              sendJson(res, 403, { ok: false, configured: true, storageType: 'local-file', sessionExpired: true, error: 'Active parent session expired due to inactivity.' });
              return;
            }
            if (!clientSessionId || clientSessionId !== existingSessionId) {
              sendJson(res, 403, { ok: false, configured: true, storageType: 'local-file', sessionReplaced: true, error: 'Active parent session belongs to another device.' });
              return;
            }
          } else if (pin !== existingParentPin) {
            sendJson(res, 403, { ok: false, configured: true, storageType: 'local-file', error: 'Parent authentication failed.' });
            return;
          }
        } else if (authRole === 'suhyun' || authRole === 'dahyun') {
          if (authRole !== childKey) {
            sendJson(res, 403, { ok: false, configured: true, storageType: 'local-file', error: 'Cannot upload for sibling.' });
            return;
          }
          const defaultChildPin = childKey === 'suhyun' ? '8864' : '7749';
          const childPins = (existing?.childPins || {}) as Record<string, unknown>;
          const expectedPin =
            typeof childPins[childKey] === 'string' && String(childPins[childKey]).trim().length >= 4
              ? String(childPins[childKey]).trim()
              : defaultChildPin;
          if (pin !== expectedPin) {
            sendJson(res, 403, { ok: false, configured: true, storageType: 'local-file', error: 'Child authentication failed.' });
            return;
          }
        } else {
          sendJson(res, 403, { ok: false, configured: true, storageType: 'local-file', error: 'Authentication required.' });
          return;
        }

        const recordedAt = Date.now();
        fs.mkdirSync(LOCAL_AUDIO_DIR, {recursive: true});
        fs.writeFileSync(
          path.join(LOCAL_AUDIO_DIR, `${audioId}.json`),
          JSON.stringify({ audioId, mimeType, dataBase64, durationSec, recordedAt }),
          'utf8'
        );

        const recordingMeta = { audioId, mimeType, durationSec, recordedAt };
        let nextUpdatedAt = recordedAt;

        if (existing && existing.childrenData && typeof existing.childrenData === 'object') {
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
              youtubeLogs: [],
            }),
          };
          weekObj.readingRecordings = {
            ...((weekObj.readingRecordings as Record<string, unknown>) || {}),
            [dayKey]: recordingMeta,
          };
          weeks[weekId] = weekObj;
          childObj.weeks = weeks;
          childrenData[childKey] = childObj;

          const prevUpdated =
            typeof existing.updatedAt === 'number' && Number.isFinite(existing.updatedAt)
              ? existing.updatedAt
              : 0;
          nextUpdatedAt = Math.max(recordedAt, prevUpdated + 1);
          const nextParentSession =
            authRole === 'parent' &&
            existingSessionId &&
            clientSessionId === existingSessionId &&
            existing?.activeParentSession &&
            typeof existing.activeParentSession === 'object'
              ? {
                  ...(existing.activeParentSession as Record<string, unknown>),
                  lastActiveAt: recordedAt,
                }
              : existing.activeParentSession;
          const updatedState = {
            ...existing,
            ...(nextParentSession !== undefined ? { activeParentSession: nextParentSession } : {}),
            updatedAt: nextUpdatedAt,
            childrenData,
          };
          fs.mkdirSync(path.dirname(LOCAL_STATE_FILE), {recursive: true});
          fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(updatedState, null, 2), 'utf8');
        }

        sendJson(res, 200, {
          ok: true,
          configured: true,
          storageType: 'local-file',
          recording: recordingMeta,
          updatedAt: nextUpdatedAt,
        });
      })
      .catch((err) => {
        sendJson(res, 400, {
          ok: false,
          configured: true,
          storageType: 'local-file',
          error: err instanceof Error ? err.message : 'Invalid JSON payload',
        });
      });
    return;
  }

  sendJson(res, 405, {
    ok: false,
    configured: true,
    storageType: 'local-file',
    error: `Method ${method} not allowed`,
  });
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'local-cloud-state-api',
        configureServer(server): void {
          server.middlewares.use(localCloudStateMiddleware);
          server.middlewares.use(localCloudAudioMiddleware);
        },
        configurePreviewServer(server): void {
          server.middlewares.use(localCloudStateMiddleware);
          server.middlewares.use(localCloudAudioMiddleware);
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
