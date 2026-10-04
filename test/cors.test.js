import assert from 'node:assert/strict';
import test from 'node:test';
import { corsHeaders } from '../src/cors.js';

test('allows every browser origin for the public detection feed', () => {
  assert.deepEqual(corsHeaders(), {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Access-Control-Max-Age': '86400',
  });
});

test('does not vary the public feed policy by requesting origin', () => {
  assert.deepEqual(corsHeaders('http://localhost:5173'), corsHeaders('https://showcase.example'));
});
