import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_AREAS, createRuntimeConfig } from '../src/config.js';

const cameraEnv = {
  CAMERA_URL: 'https://camera.example.test/live',
  CAMERA_MEDIA_TYPE: 'video',
  CAMERA_SELECTOR: 'video#live',
  CAMERA_READY_SELECTOR: 'video#live',
};

test('uses one configured camera and a one-minute refresh by default', () => {
  const config = createRuntimeConfig(cameraEnv);
  assert.equal(config.intervalMs, 60000);
  assert.equal(config.camera.url, cameraEnv.CAMERA_URL);
  assert.equal(config.camera.mediaType, 'video');
  assert.deepEqual(
    config.camera.parkingAreas.map(({ id, points, capacity }) => ({ id, points, capacity })),
    DEFAULT_AREAS,
  );
});

test('accepts a configured video source', () => {
  const config = createRuntimeConfig({
    CAMERA_URL: 'https://camera.example.test/live',
    CAMERA_MEDIA_TYPE: 'video',
    CAMERA_SELECTOR: 'video#live',
    CAMERA_READY_SELECTOR: 'video#live',
    CAPTURE_INTERVAL_SECONDS: '60',
  });
  assert.equal(config.camera.mediaType, 'video');
  assert.equal(config.camera.selector, 'video#live');
});

test('rejects an absent camera, invalid refresh intervals, and malformed area definitions', () => {
  assert.throws(() => createRuntimeConfig({}), /CAMERA_URL is required/);
  assert.throws(
    () => createRuntimeConfig({ ...cameraEnv, CAPTURE_INTERVAL_SECONDS: '0' }),
    /CAPTURE_INTERVAL_SECONDS must be between 1 and 86400/,
  );
  assert.throws(
    () => createRuntimeConfig({ ...cameraEnv, CAMERA_AREAS_JSON: '{oops' }),
    /CAMERA_AREAS_JSON/,
  );
});
