import { validateCameras } from '../camera-worker/src/config.js';

// These are the same normalized regions configured for the AGH camera worker.
// They are also drawn into the built-in feed, so the demo remains usable offline.
export const DEFAULT_AREAS = [
  {
    id: 'area-5',
    points: [[0.3285, 0.2193], [0.3608, 0.2012], [0.4041, 0.3278], [0.3582, 0.3504], [0.3268, 0.2208]],
    capacity: 5,
  },
  {
    id: 'area-2',
    points: [[0.4278, 0.5433], [0.5458, 0.9895], [0.7572, 0.9895], [0.5085, 0.5177], [0.4295, 0.5388]],
    capacity: 2,
  },
  {
    id: 'area-3',
    points: [[0.5764, 0.4017], [0.5781, 0.3097], [0.708, 0.3067], [0.7046, 0.4002], [0.5756, 0.4002]],
    capacity: 1,
  },
];

function positiveInteger(value, name, { min, max, fallback }) {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) throw new Error(`${name} must be an integer`);
  const parsed = Number(value);
  if (parsed < min || parsed > max) throw new Error(`${name} must be between ${min} and ${max}`);
  return parsed;
}

function areasFromEnv(value) {
  if (!value) return DEFAULT_AREAS;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return parsed;
  } catch {
    throw new Error('CAMERA_AREAS_JSON must be a JSON array of parking areas');
  }
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function captureIntervalMs(env) {
  // Prefer the worker's setting so the demo and worker keep the same cadence.
  if (env.CAPTURE_INTERVAL_SECONDS !== undefined && env.CAPTURE_INTERVAL_SECONDS !== '') {
    return positiveInteger(env.CAPTURE_INTERVAL_SECONDS, 'CAPTURE_INTERVAL_SECONDS', { min: 1, max: 86400, fallback: 60 }) * 1000;
  }
  // Keep this as a backwards-compatible override for existing local setups.
  return positiveInteger(env.FRAME_INTERVAL_MS, 'FRAME_INTERVAL_MS', { min: 1000, max: 60000, fallback: 60000 });
}

function makeCamera({ id, name, url, mediaType, selector, readySelector, viewport, timeoutMs, areas }) {
  // validateCameras is shared with camera-worker, ensuring that environment overrides
  // cannot make this visual demo behave differently from the production worker.
  return validateCameras([{
    id,
    name,
    enabled: true,
    url,
    mediaType,
    selector,
    readySelector,
    viewport,
    timeoutMs,
    settleMs: 200,
    attempts: 1,
    maxCaptures: 2,
    maxMediaAgeSeconds: 900,
    startPlayback: true,
    parkingAreas: areas,
  }])[0];
}

/** Build the runtime configuration for one configured parking camera. */
export function createRuntimeConfig(env = process.env) {
  const port = positiveInteger(env.PORT, 'PORT', { min: 1, max: 65535, fallback: 3000 });
  const intervalMs = captureIntervalMs(env);
  const timeoutMs = positiveInteger(env.CAMERA_TIMEOUT_MS, 'CAMERA_TIMEOUT_MS', { min: 1000, max: 120000, fallback: 15000 });
  const viewport = {
    width: positiveInteger(env.VIEWPORT_WIDTH, 'VIEWPORT_WIDTH', { min: 320, max: 7680, fallback: 1280 }),
    height: positiveInteger(env.VIEWPORT_HEIGHT, 'VIEWPORT_HEIGHT', { min: 240, max: 4320, fallback: 720 }),
  };
  const areas = areasFromEnv(env.CAMERA_AREAS_JSON);
  const configuredUrl = optionalString(env.CAMERA_URL);
  if (!configuredUrl) throw new Error('CAMERA_URL is required');

  const camera = makeCamera({
    id: optionalString(env.CAMERA_ID) ?? 'parking-camera',
    name: optionalString(env.CAMERA_NAME) ?? 'Parking camera',
    url: configuredUrl,
    mediaType: optionalString(env.CAMERA_MEDIA_TYPE) ?? 'video',
    selector: optionalString(env.CAMERA_SELECTOR),
    readySelector: optionalString(env.CAMERA_READY_SELECTOR),
    viewport,
    timeoutMs,
    areas,
  });

  return {
    port,
    intervalMs,
    camera,
    areas,
  };
}

export function portFromEnv(env = process.env) {
  return positiveInteger(env.PORT, 'PORT', { min: 1, max: 65535, fallback: 3000 });
}
