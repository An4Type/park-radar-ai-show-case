import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_AREAS, createRuntimeConfig } from '../src/config.js';

const localFeedUrl = 'http://127.0.0.1:3000/demo-feed';

test('uses a self-contained camera feed and one-minute refresh by default', () => {
  const config = createRuntimeConfig({}, { localFeedUrl });
  assert.equal(config.intervalMs, 60000);
  assert.equal(config.usingBuiltInFeed, true);
  assert.equal(config.camera.url, localFeedUrl);
  assert.equal(config.camera.mediaType, 'page');
  assert.deepEqual(
    config.camera.parkingAreas.map(({ id, points, capacity }) => ({ id, points, capacity })),
    DEFAULT_AREAS,
  );
});

test('accepts a configured video source without configuring a demo fallback', () => {
  const config = createRuntimeConfig({
    CAMERA_URL: 'https://camera.example.test/live',
    CAMERA_MEDIA_TYPE: 'video',
    CAMERA_SELECTOR: 'video#live',
    CAMERA_READY_SELECTOR: 'video#live',
    CAPTURE_INTERVAL_SECONDS: '60',
  }, { localFeedUrl });
  assert.equal(config.usingBuiltInFeed, false);
  assert.equal(config.camera.mediaType, 'video');
  assert.equal(config.camera.selector, 'video#live');
  assert.equal('fallbackCamera' in config, false);
});

test('rejects invalid refresh intervals and malformed area definitions', () => {
  assert.throws(
    () => createRuntimeConfig({ CAPTURE_INTERVAL_SECONDS: '0' }, { localFeedUrl }),
    /CAPTURE_INTERVAL_SECONDS must be between 1 and 86400/,
  );
  assert.throws(
    () => createRuntimeConfig({ CAMERA_AREAS_JSON: '{oops' }, { localFeedUrl }),
    /CAMERA_AREAS_JSON/,
  );
});
