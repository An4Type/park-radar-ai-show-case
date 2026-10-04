import express from 'express';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuntimeConfig, portFromEnv } from './config.js';
import { FrameService } from './frame-service.js';

const here = fileURLToPath(new URL('..', import.meta.url));
const publicDir = resolve(here, 'public');
const runtimeDir = resolve(here, '.runtime');
const port = portFromEnv();
const host = process.env.HOST?.trim() || '0.0.0.0';

const app = express();
app.disable('x-powered-by');
app.use((_request, response, next) => {
  response.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  next();
});

let frameService = null;
let config = null;

app.get('/demo-feed', (_request, response) => {
  response.sendFile(resolve(publicDir, 'demo-feed.html'));
});

app.get('/api/status', (_request, response) => {
  const state = frameService?.getState() ?? {
    status: 'starting',
    version: 0,
    message: 'Starting camera worker…',
    areas: [],
    intervalMs: config?.intervalMs ?? 5000,
  };
  response.json(state);
});

app.get('/api/frame/:kind', (request, response) => {
  const kind = request.params.kind;
  if (!['raw', 'vision'].includes(kind)) {
    return response.status(404).json({ error: 'UNKNOWN_FRAME', message: 'Use raw or vision.' });
  }
  const frame = frameService?.getFrame(kind);
  if (!frame) {
    return response.status(503).json({ error: 'FRAME_NOT_READY', message: frameService?.getState().message ?? 'Frame is not ready.' });
  }
  response.type('png').send(frame);
});

app.post('/api/refresh', async (_request, response) => {
  if (!frameService) return response.status(503).json({ error: 'WORKER_NOT_READY' });
  // Do not hold the HTTP request open while a remote stream is loading.
  void frameService.refreshNow();
  response.status(202).json({ accepted: true, message: 'Refresh queued.' });
});

app.get('/health', (_request, response) => {
  const state = frameService?.getState();
  response.status(state?.status === 'error' ? 503 : 200).json({
    status: state?.status === 'error' ? 'degraded' : 'ok',
    frame: state?.status ?? 'starting',
    version: state?.version ?? 0,
  });
});

app.use(express.static(publicDir, { index: 'index.html', etag: false, maxAge: 0 }));

const server = app.listen(port, host);
await once(server, 'listening');
const address = server.address();
const boundPort = typeof address === 'object' && address ? address.port : port;
const localFeedUrl = `http://127.0.0.1:${boundPort}/demo-feed`;

try {
  config = createRuntimeConfig(process.env, { localFeedUrl });
  frameService = new FrameService({
    camera: config.camera,
    intervalMs: config.intervalMs,
    outputDir: runtimeDir,
  });
  console.log(JSON.stringify({
    service: 'vision-demo',
    event: 'started',
    url: `http://localhost:${boundPort}`,
    intervalSeconds: config.intervalMs / 1000,
    source: config.usingBuiltInFeed ? 'built-in-demo-feed' : config.camera.url,
    areas: config.areas.map((area) => area.id),
  }));
  void frameService.start();
} catch (error) {
  console.error(JSON.stringify({ service: 'vision-demo', event: 'configuration_error', message: error.message }));
  server.close();
  process.exitCode = 1;
}

async function shutdown(signal) {
  console.log(JSON.stringify({ service: 'vision-demo', event: 'shutdown_requested', signal }));
  await frameService?.stop();
  await new Promise((resolveClose) => server.close(resolveClose));
}

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
