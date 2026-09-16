import axios from 'axios';
import * as cheerio from 'cheerio';

function parseDuration(value) {
  const parts = value.trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
  return 0;
}

function parseKattisDate(value) {
  const normalized = value.trim().replace(/\bCEST\b/, '+02:00').replace(/\bCET\b/, '+01:00');
  return new Date(normalized);
}

export async function fetchKattisContests() {
  try {
    const response = await axios.get('https://open.kattis.com/contests', {
      timeout: 12000,
      headers: { 'User-Agent': 'CP-Schedule-Extension/1.0' },
    });
    const $ = cheerio.load(response.data);
    const now = Date.now();
    const contests = [];

    $('table').slice(0, 2).find('tbody tr').each((_, row) => {
      const cells = $(row).find('td');
      const link = $(row).find('a[href^="/contests/"]').first();
      const title = link.text().replace(/\s+/g, ' ').trim();
      const values = cells.map((__, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get();
      const startTime = parseKattisDate(values[1] || '');
      const durationSeconds = parseDuration(values[2] || '');
      const endTime = new Date(startTime.getTime() + durationSeconds * 1000);
      const contestId = link.attr('href')?.split('/').pop();

      if (!title || !contestId || isNaN(startTime.getTime()) || !durationSeconds || endTime.getTime() < now) return;

      contests.push({
        contestId: `kattis-${contestId}`,
        platform: 'Kattis',
        title,
        url: `https://open.kattis.com/contests/${contestId}`,
        startTime,
        endTime,
        durationSeconds,
        status: startTime.getTime() <= now ? 'CODING' : 'BEFORE',
      });
    });

    const unique = new Map(contests.map((contest) => [contest.contestId, contest]));
    console.log(`[Kattis Service] Loaded ${unique.size} active/upcoming contests.`);
    return Array.from(unique.values());
  } catch (error) {
    console.warn('[Kattis Service] API warning:', error.message);
    return [];
  }
}
