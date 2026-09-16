import axios from 'axios';

/**
 * Fetches upcoming contests from multiple APIs:
 * - Kontests.net (aggregates CF, LC, AtCoder, CodeChef, HackerEarth, etc.)
 * - CLIST.by (covers HackerCup, Google Kickstart, Google Code Jam, TopCoder, etc.)
 */

// ─── CLIST.by (covers HackerCup, Google, TopCoder, HackerEarth, etc.) ──────────
async function fetchClistContests() {
  try {
    // CLIST has a public API; using the JSON feed endpoint
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days out

    const res = await axios.get('https://clist.by/api/v4/contest/', {
      timeout: 12000,
      params: {
        order_by: 'start',
        start__gt: now.toISOString(),
        end__lt: future.toISOString(),
        limit: 100,
        format: 'json',
        // Filter to known CP resources
        resource__name__in: [
          'codeforces.com',
          'leetcode.com',
          'atcoder.jp',
          'codechef.com',
          'hackerearth.com',
          'topcoder.com',
          'facebook.com/hackercup',
          'meta.com',
          'codingcompetitions.withgoogle.com',
          'hackerrank.com',
          'geeksforgeeks.org',
        ].join(','),
      },
    });

    if (!res.data?.objects) return [];

    return res.data.objects.map(item => {
      const startTime = new Date(item.start);
      const endTime = new Date(item.end);
      const resource = (item.resource || '').toLowerCase();

      let platform = 'Other';
      if (resource.includes('codeforces')) platform = 'Codeforces';
      else if (resource.includes('leetcode')) platform = 'LeetCode';
      else if (resource.includes('atcoder')) platform = 'AtCoder';
      else if (resource.includes('codechef')) platform = 'CodeChef';
      else if (resource.includes('hackerearth')) platform = 'HackerEarth';
      else if (resource.includes('meta.com')) platform = 'Meta';
      else if (resource.includes('hackercup') || resource.includes('facebook')) platform = 'HackerCup';
      else if (resource.includes('google') || resource.includes('codingcompetitions')) platform = 'Google';
      else if (resource.includes('topcoder')) platform = 'TopCoder';
      else if (resource.includes('hackerrank')) platform = 'HackerRank';

      const durationSec = Math.max(0, Math.floor((endTime - startTime) / 1000));
      const nowMs = Date.now();
      const startMs = startTime.getTime();
      const endMs = endTime.getTime();

      return {
        contestId: `clist-${item.id}`,
        platform,
        title: item.event || item.title || 'Contest',
        url: item.href || `https://clist.by/contest/${item.id}/`,
        startTime,
        endTime,
        durationSeconds: durationSec,
        status: startMs <= nowMs && endMs >= nowMs ? 'CODING' : 'BEFORE',
      };
    });
  } catch (err) {
    console.warn('[Universal CP Service] CLIST API warning:', err.message);
    return [];
  }
}

// ─── Kontests.net (quick fallback, covers CF/LC/AC/CC/HE) ──────────────────────
async function fetchKontestsContests() {
  try {
    const response = await axios.get('https://kontests.net/api/v1/all', {
      timeout: 10000,
    });

    if (!Array.isArray(response.data)) return [];

    const now = Date.now();
    const contests = [];

    for (const item of response.data) {
      if (!item.name || !item.start_time || !item.end_time) continue;

      const startTime = new Date(item.start_time);
      const endTime = new Date(item.end_time);
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) continue;

      const endMs = endTime.getTime();
      if (endMs < now) continue;

      const nameLower = item.name.toLowerCase();
      const siteLower = (item.site || '').toLowerCase();

      let platform = 'Other';
      if (siteLower.includes('codeforces') || nameLower.includes('codeforces')) platform = 'Codeforces';
      else if (siteLower.includes('leetcode') || nameLower.includes('leetcode')) platform = 'LeetCode';
      else if (siteLower.includes('atcoder') || nameLower.includes('atcoder')) platform = 'AtCoder';
      else if (siteLower.includes('codechef') || nameLower.includes('codechef')) platform = 'CodeChef';
      else if (siteLower.includes('hackerearth') || nameLower.includes('hackerearth')) platform = 'HackerEarth';
      else if (siteLower.includes('meta') || nameLower.includes('meta')) platform = 'Meta';
      else if (siteLower.includes('hackercup') || siteLower.includes('facebook') || nameLower.includes('hackercup')) platform = 'HackerCup';
      else if (siteLower.includes('google') || siteLower.includes('codingcompetitions') || nameLower.includes('google') || nameLower.includes('kickstart') || nameLower.includes('code jam') || nameLower.includes('hash code')) platform = 'Google';
      else if (siteLower.includes('topcoder') || nameLower.includes('topcoder')) platform = 'TopCoder';
      else if (siteLower.includes('hackerrank') || nameLower.includes('hackerrank')) platform = 'HackerRank';

      const startMs = startTime.getTime();
      const durationSec = item.duration
        ? parseFloat(item.duration)
        : Math.max(0, Math.floor((endMs - startMs) / 1000));

      const rawId = item.url
        ? encodeURIComponent(item.url).slice(-30)
        : item.name.replace(/\s+/g, '-').toLowerCase().slice(0, 40);

      contests.push({
        contestId: `kontests-${platform.toLowerCase()}-${rawId}`,
        platform,
        title: item.name,
        url: item.url || 'https://kontests.net',
        startTime,
        endTime,
        durationSeconds: durationSec,
        status: startMs <= now && endMs >= now ? 'CODING' : 'BEFORE',
      });
    }

    return contests;
  } catch (error) {
    console.warn('[Universal CP Service] Kontests API warning:', error.message);
    return [];
  }
}

// ─── Exported aggregator ────────────────────────────────────────────────────────
export async function fetchUniversalCpContests() {
  // Run both APIs concurrently; combine and deduplicate
  const [clistContests, kontestsContests] = await Promise.all([
    fetchClistContests(),
    fetchKontestsContests(),
  ]);

  const all = [...clistContests, ...kontestsContests];

  // Deduplicate by title similarity (normalize to lowercase, trim)
  const seen = new Map();
  for (const c of all) {
    const key = `${c.platform.toLowerCase()}_${c.title.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    if (!seen.has(key)) seen.set(key, c);
  }

  const result = Array.from(seen.values());
  console.log(`[Universal CP Service] Loaded ${result.length} contests (CLIST: ${clistContests.length}, Kontests: ${kontestsContests.length})`);
  return result;
}
