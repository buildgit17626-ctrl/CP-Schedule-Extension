import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHash } from 'node:crypto';
import { createProfileRouter } from '../src/routes/profiles.js';
import { validateHandles, fetchPublicProfile } from '../src/services/profileService.js';
test('sharing requires consent; admin access is separate; withdrawal cannot recreate a record', async () => {
  const records = new Map(), admin = 'a'.repeat(64), user = 'b'.repeat(64), other = 'c'.repeat(64);
  let enabled = true, ready = true, release, began;
  const started = new Promise(resolve => { began = resolve; });
  const store = { ready: () => ready,
    save: async (id, value) => { records.set(id, { _id: id, ...value }); }, remove: async id => records.delete(id), get: async id => records.get(id),
    page: async () => [...records.values()], refresh: async (id, consentRevision, snapshots) => { const current = records.get(id); if (current?.consentRevision === consentRevision) Object.assign(current, { snapshots, refreshedAt: new Date() }); },
  };
  const app = express(); app.use(express.json()); app.use('/api/v1', createProfileRouter({ store, enabled: () => enabled, adminKey: () => admin, fetchProfile: async () => { began(); await new Promise(resolve => { release = resolve; }); return { rating: 1200 }; } }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
  const call = (path, token, method = 'GET', body) => fetch(base + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const status = await fetch(base + '/profile-sharing/status');
    assert.equal(status.status, 200);
    assert.equal((await status.json()).data.available, true);
    assert.equal((await call('/profile-sharing', user, 'PUT', { handles: { LeetCode: 'me' } })).status, 400);
    const consent = { consent: true, consentVersion: 'profiles-v1', handles: { LeetCode: 'me' } };
    assert.equal((await call('/profile-sharing', user, 'PUT', consent)).status, 200);
    assert.equal((await call('/admin/profiles', user)).status, 401);
    const list = await call('/admin/profiles', admin); assert.equal(list.status, 200); assert.equal(list.headers.get('cache-control'), 'no-store');
    const data = (await list.json()).data; assert.equal(data.items.length, 1); assert.equal(JSON.stringify(data).includes(user), false);
    assert.equal((await call('/profile-sharing', other, 'DELETE')).status, 200); assert.equal(records.size, 1);
    const id = createHash('sha256').update(user).digest('hex');
    const refreshing = call('/admin/profiles/' + id + '/refresh', admin, 'POST'); await started;
    await call('/profile-sharing', user, 'DELETE'); release(); await refreshing;
    assert.equal(records.size, 0);
    enabled = false;
    assert.equal((await (await fetch(base + '/profile-sharing/status')).json()).data.reason, 'not_enabled');
    assert.equal((await call('/profile-sharing', user, 'PUT', consent)).status, 503);
    assert.equal((await call('/profile-sharing', user, 'DELETE')).status, 200);
    assert.equal((await call('/missing', user)).status, 404);
    ready = false; enabled = true;
    assert.equal((await (await fetch(base + '/profile-sharing/status')).json()).data.reason, 'database_unavailable');
    assert.equal((await call('/profile-sharing', user, 'DELETE')).status, 503);
  } finally { server.close(); }
});
test('profile handles reject unsupported platforms, URL injection and malformed IDs', () => {
  assert.deepEqual(validateHandles({ Codeforces: 'me-1', CSES: '123', LeetCode: '' }), { Codeforces: 'me-1', CSES: '123' });
  for (const handles of [{ Evil: 'me' }, { CSES: '../admin' }, { LeetCode: 'https://evil.test' }, []]) assert.throws(() => validateHandles(handles));
});
test('LeetCode reads only public rating and solved aggregates and marks failures unavailable', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, undefined); assert.equal(options.body.includes('sourceCode'), false);
    return new Response(JSON.stringify({ data: { matchedUser: { username: 'me', submitStatsGlobal: { acSubmissionNum: [{ difficulty: 'All', count: 42 }] } }, userContestRanking: { rating: 1500 } } }));
  };
  try { const result = await fetchPublicProfile('LeetCode', 'me'); assert.equal(result.solved, 42); assert.equal(result.rating, 1500);
    globalThis.fetch = async () => new Response('', { status: 403 }); assert.equal((await fetchPublicProfile('LeetCode', 'me')).status, 'unavailable');
  } finally { globalThis.fetch = original; }
});
