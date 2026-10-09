import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Checks if an AtCoder contest is a genuine official contest (ABC, ARC, AGC, AHC).
 * Filters out practice, daily, weekday, training, or community contests.
 */
function isMainAtCoderContest(title, slug = '') {
  if (!title) return false;
  const cleanTitle = title.replace(/[^\x00-\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
  const lowerTitle = cleanTitle.toLowerCase();
  const lowerSlug = (slug || '').toLowerCase();

  // Word boundary on test so it doesn't match 'conTEST'
  if (/practice|weekday|daily|training|selection|\btest\b|virtual/i.test(lowerTitle)) {
    return false;
  }

  return (
    lowerSlug.startsWith('abc') ||
    lowerSlug.startsWith('arc') ||
    lowerSlug.startsWith('agc') ||
    lowerSlug.startsWith('ahc') ||
    lowerTitle.includes('atcoder beginner contest') ||
    lowerTitle.includes('atcoder regular contest') ||
    lowerTitle.includes('atcoder grand contest') ||
    lowerTitle.includes('atcoder heuristic contest') ||
    /\b(abc|arc|agc|ahc)\d+\b/i.test(cleanTitle)
  );
}

/**
 * Fallback 1: Fetch contests from Kenkoooo AtCoder API
 */
async function fetchAtCoderFromProblems() {
  try {
    const response = await axios.get('https://kenkoooo.com/atcoder/resources/contests.json', {
      timeout: 12000,
    });
    if (!Array.isArray(response.data)) throw new Error('Invalid AtCoder fallback response');

    const now = Date.now();
    return response.data
      .map((item) => {
        const startTime = new Date(item.start_epoch_second * 1000);
        const endTime = new Date((item.start_epoch_second + item.duration_second) * 1000);
        if (!item.id || !item.title || !isMainAtCoderContest(item.title, item.id) || isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return null;
        if (endTime.getTime() < now) return null;

        const cleanTitle = item.title.replace(/[^\x00-\x7F]/g, ' ').replace(/\s+/g, ' ').trim();

        return {
          contestId: `ac-${item.id}`,
          platform: 'AtCoder',
          title: cleanTitle,
          url: `https://atcoder.jp/contests/${item.id}`,
          startTime,
          endTime,
          durationSeconds: Math.max(0, Number(item.duration_second) || 0),
          status: startTime.getTime() <= now ? 'CODING' : 'BEFORE',
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.warn('[AtCoder Service] Kenkoooo fallback warning:', err.message);
    throw err;
  }
}

/**
 * Primary Fetcher: Scrape official AtCoder contests page (atcoder.jp/contests/)
 */
export async function fetchAtCoderContests() {
  console.log('[AtCoder Service] Fetching official AtCoder contests...');
  try {
    const response = await axios.get('https://atcoder.jp/contests/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 12000,
    });

    const $ = cheerio.load(response.data);
    const contests = [];
    const now = Date.now();

    $('table').each((tableIdx, table) => {
      $(table).find('tbody tr').each((trIdx, element) => {
        const tdList = $(element).find('td');
        if (tdList.length < 2) return;

        const timeTd = $(tdList[0]);
        const titleTd = $(tdList[1]);
        const durationTd = tdList.length >= 3 ? $(tdList[2]) : null;

        const timeStr = timeTd.find('a').text().trim() || timeTd.text().trim();
        const titleAnchor = titleTd.find('a').last();
        const rawTitle = titleAnchor.text().trim();
        const relUrl = titleAnchor.attr('href') || '';
        const slug = relUrl.split('/').filter(Boolean).pop() || '';

        const cleanTitle = rawTitle.replace(/[^\x00-\x7F]/g, ' ').replace(/\s+/g, ' ').trim();

        if (!rawTitle || !relUrl) return;

        const isMain = isMainAtCoderContest(rawTitle, slug);
        if (!isMain) return;

        const fullUrl = relUrl.startsWith('http') ? relUrl : `https://atcoder.jp${relUrl}`;

        let startTime = null;
        if (timeStr) {
          let formattedTimeStr = timeStr.replace(/\s+/, 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
          if (!formattedTimeStr.includes('+') && !formattedTimeStr.includes('Z')) {
            formattedTimeStr += '+09:00';
          }
          startTime = new Date(formattedTimeStr);
        }

        if (!startTime || isNaN(startTime.getTime())) return;

        let durationSeconds = 6000;
        if (durationTd) {
          const durText = durationTd.text().trim();
          const parts = durText.split(':');
          if (parts.length === 2) {
            const hrs = parseInt(parts[0], 10) || 0;
            const mins = parseInt(parts[1], 10) || 0;
            durationSeconds = hrs * 3600 + mins * 60;
          }
        }

        const startMs = startTime.getTime();
        const endMs = startMs + durationSeconds * 1000;
        const endTime = new Date(endMs);

        if (endMs < now) return;

        contests.push({
          contestId: `ac-${slug}`,
          platform: 'AtCoder',
          title: cleanTitle,
          url: fullUrl,
          startTime,
          endTime,
          durationSeconds,
          status: startMs <= now && endMs >= now ? 'CODING' : 'BEFORE',
        });
      });
    });

    if (contests.length > 0) {
      console.log(`[AtCoder Service] Successfully loaded ${contests.length} upcoming official AtCoder contests.`);
      return contests;
    }

    console.warn('[AtCoder Service] Scraper found 0 official contests; using Kenkoooo fallback.');
    return await fetchAtCoderFromProblems();
  } catch (error) {
    console.warn('[AtCoder Service] Primary scraper failed:', error.message);
    return await fetchAtCoderFromProblems();
  }
}
