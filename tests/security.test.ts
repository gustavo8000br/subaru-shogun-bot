import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeExternalText, SlidingWindowRateLimiter } from '../src/security.js';

test('normalizes control characters, mentions remain inert text, and truncates input', () => {
  const value = normalizeExternalText('@everyone\u0000 hello\nworld', 17);
  assert.equal(value, '@everyone hello w');
});

test('rate limiter rejects bursts and allows events after the window', async () => {
  const limiter = new SlidingWindowRateLimiter(2, 10);
  assert.equal(limiter.allow('guild:user'), true);
  assert.equal(limiter.allow('guild:user'), true);
  assert.equal(limiter.allow('guild:user'), false);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(limiter.allow('guild:user'), true);
});
