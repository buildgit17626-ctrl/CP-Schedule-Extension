import * as cheerio from 'cheerio';
export const CONSENT_VERSION = 'profiles-v1';
const origins = { Codeforces: 'https://codeforces.com/profile/', LeetCode: 'https://leetcode.com/u/', AtCoder: 'https://atcoder.jp/users/', CodeChef: 'https://www.codechef.com/users/', CSES: 'https://cses.fi/user/' };
export function validateHandles(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Enter your public profile handles.');
  const entries = Object.entries(value).filter(([, handle]) => handle !== '');
  if (!entries.length || entries.length > 5) throw new Error('Enter 1–5 public profile handles.');
  for (const [platform, handle] of entries) if (!origins[platform] || typeof handle !== 'string' || !(platform === 'CSES' ? /^\d{1,12}$/ : /^[A-Za-z0-9_.-]{1,64}$/).test(handle)) throw new Error('Invalid profile handle.');
  return Object.fromEntries(entries);
}
async function read(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw new Error('Profile service unavailable');
  const reader = response.body.getReader(); const chunks = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length; if (length > 2097152) throw new Error('Profile response too large'); chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}
let cfQueue = Promise.resolve(), cfWaiting = 0, cfLast = 0;
async function cf(method, params) {
  if (cfWaiting >= 20) throw new Error('Profile refresh busy');
  cfWaiting++;
  const next = cfQueue.then(async () => {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 2100 - (Date.now() - cfLast))));
    cfLast = Date.now();
    const data = JSON.parse(await read(`https://codeforces.com/api/${method}?${new URLSearchParams(params)}`));
    if (data.status !== 'OK') throw new Error('Profile unavailable'); return data.result;
  });
  cfQueue = next.catch(() => {});
  try { return await next; } finally { cfWaiting--; }
}
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
export async function fetchPublicProfile(platform, handle) {
  const base = { platform, handle, url: origins[platform] + encodeURIComponent(handle) + '/', checkedAt: new Date().toISOString(), rating: null, maxRating: null, solved: null, solvedPartial: false };
  try {
    if (platform === 'Codeforces') {
      const [user] = await cf('user.info', { handles: handle });
      const submissions = await cf('user.status', { handle, from: 1, count: 1000, includeSources: false });
      base.rating = number(user.rating); base.maxRating = number(user.maxRating);
      base.solved = new Set(submissions.filter(item => item.verdict === 'OK' && item.problem && (item.problem.contestId || item.problem.problemsetName || item.problem.name)).map(({ problem }) => problem.contestId ? `${problem.contestId}:${problem.index}` : `${problem.problemsetName || 'other'}:${problem.index || ''}:${problem.name || ''}`)).size;
      base.solvedPartial = submissions.length === 1000;
      base.solvedScope = 'Public accepted problems in the latest 1,000 submissions';
    } else if (platform === 'LeetCode') {
      const data = JSON.parse(await read('https://leetcode.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query($username:String!){matchedUser(username:$username){username submitStatsGlobal{acSubmissionNum{difficulty count}}} userContestRanking(username:$username){rating}}', variables: { username: handle } }) }));
      if (!data.data?.matchedUser || data.errors?.length) throw new Error('Profile unavailable');
      base.rating = number(data.data.userContestRanking?.rating);
      base.solved = number(data.data.matchedUser.submitStatsGlobal?.acSubmissionNum?.find(item => item.difficulty === 'All')?.count);
    } else if (platform === 'AtCoder' || platform === 'CodeChef') {
      const html = await read(base.url), $ = cheerio.load(html);
      if (platform === 'AtCoder') {
        $('tr').each((_index, row) => {
          const label = $(row).find('th').text().trim(), value = Number($(row).find('td').text().trim().replaceAll(',', ''));
          if (label === 'Rating' && Number.isFinite(value)) base.rating = value;
          if (label === 'Highest Rating' && Number.isFinite(value)) base.maxRating = value;
        });
      } else {
        const rating = $('.rating-number').first().text().trim();
        base.rating = /^\d+$/.test(rating) ? Number(rating) : null;
        const solved = /Total Problems Solved:\s*([\d,]+)/i.exec($('body').text());
        base.solved = solved ? Number(solved[1].replaceAll(',', '')) : null;
      }
    } else {
      await read(base.url); // CSES has no contest rating; private solved sheets are not fetched.
    }
    return { ...base, status: 'available' };
  } catch { return { ...base, status: 'unavailable' }; }
}
