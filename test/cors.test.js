import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedOriginsFromEnv, corsHeaders } from '../src/cors.js';

test('allows every browser origin by default for the public detection feed', () => {
  assert.deepEqual(allowedOriginsFromEnv(), ['*']);
  assert.deepEqual(corsHeaders('https://showcase.example'), {
    'Access-Control-Allow-Origin': '*',
  });
});

test('reflects only explicitly configured frontend origins', () => {
  const allowed = allowedOriginsFromEnv('https://demo.example, http://localhost:8787');
  assert.deepEqual(corsHeaders('https://demo.example', allowed), {
    'Access-Control-Allow-Origin': 'https://demo.example',
    Vary: 'Origin',
  });
  assert.deepEqual(corsHeaders('https://untrusted.example', allowed), {});
});
