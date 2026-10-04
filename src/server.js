import express from 'express';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuntimeConfig, portFromEnv } from './config.js';
import { createCorsMiddleware } from './cors.js';
import { FrameService } from './frame-service.js';

const projectDir = fileURLToPath(new URL('..', import.meta.url));
const runtimeDir = resolve(projectDir, '.runtime');
const port = portFromEnv();
const host = process.env.HOST?.trim() || '0.0.0.0';

const app = express();
app.disable('x-powered-by');
app.use(createCorsMiddleware());
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

// This service intentionally exposes one API resource. The annotated PNG is embedded
// in its JSON response so a client needs no separate status, image, or refresh routes.
app.get('/api/detection', (request, response) => {
  const state = frameService?.getState() ?? {
    status: 'starting',
    version: 0,
    message: 'Starting camera worker…',
    areas: [],
    intervalMs: config?.intervalMs ?? 5000,
  };
  if (request.query.refresh === 'true' && frameService) {
    // The latest completed detection remains available while a fresh capture is queued.
    void frameService.refreshNow();
  }
  const originalFrame = frameService?.getOriginalFrame();
  const visionFrame = frameService?.getVisionFrame();
  const status = state.status === 'ready' ? 200 : state.status === 'error' ? 503 : 202;
  response.status(status).json({
    ...state,
    image: visionFrame ? `data:image/png;base64,${visionFrame.toString('base64')}` : null,
    originalImage: originalFrame ? `data:image/png;base64,${originalFrame.toString('base64')}` : null,
  });
});

const server = app.listen(port, host);
await once(server, 'listening');
const address = server.address();
const boundPort = typeof address === 'object' && address ? address.port : port;
try {
  config = createRuntimeConfig(process.env);
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
    source: config.camera.url,
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
