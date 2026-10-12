import test from 'node:test';
import assert from 'node:assert/strict';
import { recordSourceResults, getSourceHealth } from '../src/jobs/sourceHealth.js';
import axios from 'axios';
import { fetchCodeforcesContests } from '../src/services/codeforcesService.js';

test('feed health distinguishes failure and empty schedules without exposing errors', () => {
  recordSourceResults([{ status: 'fulfilled', value: [{ contestId: 'one' }] }, { status: 'fulfilled', value: [] }, { status: 'rejected', reason: new Error('secret api_key=abc') }], 1000);
  const result = getSourceHealth();
  assert.equal(result.items[0].status, 'available');
  assert.equal(result.items[1].status, 'empty');
  assert.equal(result.items[2].status, 'unavailable');
  assert.equal(JSON.stringify(result).includes('secret'), false);
  recordSourceResults([{ status: 'rejected', reason: new Error('offline') }], 2000);
  assert.equal(getSourceHealth().items[0].lastDataAt, 1000);
  assert.equal(getSourceHealth().items[0].checkedAt, 2000);
});

test('source adapter reports network failure instead of a successful empty schedule', async () => {
  const original = axios.get;
  axios.get = async () => { throw new Error('fixture offline'); };
  try { await assert.rejects(fetchCodeforcesContests(), /fixture offline/); }
  finally { axios.get = original; }
});
