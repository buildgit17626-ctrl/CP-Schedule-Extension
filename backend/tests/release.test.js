import test from 'node:test';
import assert from 'node:assert/strict';
import cron from 'node-cron';
import { rateLimit } from '../src/middleware/rateLimit.js';
test('request limits isolate clients, bound tracked clients and recover after expiry', () => {
  let time = 0, allowed = 0, status, retry;
  const middleware = rateLimit({ limit: 2, maxClients: 1, windowMs: 1000, now: () => time });
  const res = { set(_name, value) { retry = value; }, status(value) { status = value; return this; }, json() {} };
  const request = ip => middleware({ ip }, res, () => { allowed++; });
  request('one'); request('one'); request('one');
  assert.equal(allowed, 2); assert.equal(status, 429); assert.equal(retry, '1');
  request('two'); assert.equal(allowed, 2);
  time = 1001; request('two'); assert.equal(allowed, 3);
});
test('upgraded scheduler executes asynchronous tasks and destroys cleanly', async () => {
  let runs = 0;
  const task = cron.createTask('*/30 * * * *', async () => { runs++; }, { timezone: 'UTC', noOverlap: true });
  try { await task.execute(); assert.equal(runs, 1); }
  finally { await task.destroy(); }
  assert.equal(task.getStatus(), 'destroyed');
});
