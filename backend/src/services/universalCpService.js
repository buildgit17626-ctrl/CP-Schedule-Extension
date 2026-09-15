import axios from 'axios';

/**
 * Fetches upcoming contests across CodeChef, HackerCup, Google, Codeforces, LeetCode, AtCoder and others
 * from global CP APIs and Kontests API aggregator.
 */
export async function fetchUniversalCpContests() {
  try {
    const response = await axios.get('https://kontests.net/api/v1/all', {
      timeout: 10000,
    });

    if (!Array.isArray(response.data)) {
      return [];
    }

    const now = Date.now();
    const contests = [];

    for (const item of response.data) {
      if (!item.name || !item.start_time || !item.end_time) continue;

      const startTime = new Date(item.start_time);
      const endTime = new Date(item.end_time);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) continue;

      const startMs = startTime.getTime();
      const endMs = endTime.getTime();

      // Only include upcoming or currently active contests
      if (endMs < now) continue;

      const nameLower = item.name.toLowerCase();
      const siteLower = (item.site || '').toLowerCase();

      let platform = 'Other';
      if (nameLower.includes('codeforces') || siteLower.includes('codeforces')) platform = 'Codeforces';
      else if (nameLower.includes('leetcode') || siteLower.includes('leetcode')) platform = 'LeetCode';
      else if (nameLower.includes('atcoder') || siteLower.includes('atcoder')) platform = 'AtCoder';
      else if (nameLower.includes('codechef') || siteLower.includes('codechef')) platform = 'CodeChef';
      else if (nameLower.includes('hacker') || siteLower.includes('hacker') || nameLower.includes('meta')) platform = 'HackerCup';
      else if (siteLower.includes('google') || nameLower.includes('google')) platform = 'Google';
      else if (siteLower.includes('topcoder') || nameLower.includes('topcoder')) platform = 'TopCoder';

      const durationSeconds = item.duration
        ? parseFloat(item.duration)
        : Math.max(0, Math.floor((endMs - startMs) / 1000));

      const rawId = item.url ? encodeURIComponent(item.url).slice(-30) : item.name.replace(/\s+/g, '-').toLowerCase();

      contests.push({
        contestId: `${platform.toLowerCase()}-${rawId}`,
        platform,
        title: item.name,
        url: item.url || 'https://kontests.net',
        startTime,
        endTime,
        durationSeconds,
        status: startMs <= now && endMs >= now ? 'CODING' : 'BEFORE',
      });
    }

    return contests;
  } catch (error) {
    console.warn('[Universal CP Service] Kontests API warning:', error.message);
    return [];
  }
}
