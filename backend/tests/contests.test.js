import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import router from '../src/routes/contests.js';
import { inMemoryContests } from '../src/jobs/cron.js';
test('contest API derives current status from times and validates filters', async () => {
  const now = Date.now();
  const add = (id, start, end) => inMemoryContests.set(id, { platform: 'Codeforces', contestId: id, status: 'BEFORE', startTime: new Date(start), endTime: new Date(end) });
  add('live', now - 10000, now + 60000);
  add('old', now - 20000, now - 10000);
  add('future', now + 60000, now + 120000);
  const app = express(); app.use('/api/v1', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/v1/contests';
  try {
    const active = await (await fetch(base)).json();
    assert.equal(active.count, 2);
    assert.ok(Array.isArray(active.sourceHealth.items));
    const priorKey = process.env.CONTEST_SYNC_KEY;
    try {
      delete process.env.CONTEST_SYNC_KEY;
      assert.equal((await fetch(base + '/sync', { method: 'POST' })).status, 503);
      process.env.CONTEST_SYNC_KEY = 'fixture-admin';
      assert.equal((await fetch(base + '/sync', { method: 'POST', headers: { Authorization: 'Bearer wrong-key' } })).status, 401);
    } finally { if (priorKey === undefined) delete process.env.CONTEST_SYNC_KEY; else process.env.CONTEST_SYNC_KEY = priorKey; }
    assert.equal(active.data.find(c => c.contestId === 'live').status, 'CODING');
    const live = await (await fetch(base + '?status=CODING')).json();
    assert.deepEqual(live.data.map(c => c.contestId), ['live']);
    const old = await (await fetch(base + '?status=FINISHED')).json();
    assert.deepEqual(old.data.map(c => c.contestId), ['old']);
    assert.equal((await fetch(base + '?status=bad')).status, 400);
    assert.equal((await fetch(base + '?platform[x]=bad')).status, 400);
  } finally { server.close(); inMemoryContests.clear(); }
});
