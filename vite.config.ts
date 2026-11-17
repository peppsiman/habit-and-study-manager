import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import {defineConfig} from 'vite';

const LOCAL_STATE_FILE = path.resolve(__dirname, '.wrangler', 'local-kv-state.json');

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
      let state: unknown = null;
      if (fs.existsSync(LOCAL_STATE_FILE)) {
        const raw = fs.readFileSync(LOCAL_STATE_FILE, 'utf8');
        state = raw.trim() ? JSON.parse(raw) : null;
      }
      sendJson(res, 200, {
        ok: true,
        configured: true,
        storageType: 'local-file',
        state,
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
        if (!body || typeof body !== 'object' || !body.childrenData || typeof body.childrenData !== 'object') {
          sendJson(res, 400, {
            ok: false,
            configured: true,
            storageType: 'local-file',
            state: null,
            error: 'Invalid payload: childrenData is required.',
          });
          return;
        }
        const payload = {
          ...body,
          version: typeof body.version === 'number' ? body.version : 3,
          updatedAt:
            typeof body.updatedAt === 'number' && Number.isFinite(body.updatedAt)
              ? body.updatedAt
              : Date.now(),
        };
        fs.mkdirSync(path.dirname(LOCAL_STATE_FILE), {recursive: true});
        fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
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

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'local-cloud-state-api',
        configureServer(server): void {
          server.middlewares.use(localCloudStateMiddleware);
        },
        configurePreviewServer(server): void {
          server.middlewares.use(localCloudStateMiddleware);
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
