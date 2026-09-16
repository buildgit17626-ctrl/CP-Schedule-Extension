import axios from 'axios';

import * as cheerio from 'cheerio';

function toAtCoderContest(item) {
  const startTime = new Date(item.startTime);
  const endTime = new Date(item.endTime);
  if (!item.title || !item.url || isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return null;

  const now = Date.now();
  return {
    contestId: item.contestId,
    platform: 'AtCoder',
    title: item.title,
    url: item.url,
    startTime,
    endTime,
    durationSeconds: Math.max(0, Math.floor((endTime - startTime) / 1000)),
    status: startTime.getTime() <= now && endTime.getTime() >= now ? 'CODING' : 'BEFORE',
  };
}

async function fetchAtCoderFromKontests() {
  const response = await axios.get('https://kontests.net/api/v1/atcoder', { timeout: 10000 });
  if (!Array.isArray(response.data)) return [];

  return response.data
    .map((item) => {
      const url = item.url || 'https://atcoder.jp/contests/';
      const title = item.name || 'AtCoder Contest';
      const contestId = `atcoder-${encodeURIComponent(url).slice(-50)}`;
      return toAtCoderContest({
        contestId,
        title,
        url,
        startTime: item.start_time,
        endTime: item.end_time,
      });
    })
    .filter(Boolean);
}

export async function fetchAtCoderContests() {
  try {
    const response = await axios.get('https://atcoder.jp/contests/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const contests = [];
    const now = Date.now();

    // AtCoder has removed the old table IDs; identify active/upcoming tables by their header.
    $('table').filter((_, table) =>
      $(table).find('th').first().text().toLowerCase().includes('start time')
    ).find('tbody tr').each((_, element) => {
      const tdList = $(element).find('td');
      if (tdList.length < 2) return;

      const timeTd = $(tdList[0]);
      const titleTd = $(tdList[1]);
      const durationTd = tdList.length >= 3 ? $(tdList[2]) : null;

      const timeStr = timeTd.find('a').text().trim() || timeTd.text().trim();
      const titleAnchor = titleTd.find('a').last();
      const title = titleAnchor.text().trim();
      const relUrl = titleAnchor.attr('href');

      if (!title || !relUrl) return;

      const fullUrl = relUrl.startsWith('http') ? relUrl : `https://atcoder.jp${relUrl}`;
      const slug = relUrl.split('/').pop();

      // Parse start time (AtCoder times are JST / +09:00)
      let startTime = null;
      if (timeStr) {
        // Format ISO-8601 string if offset missing or formatted with space
        const formattedTimeStr = timeStr.replace(/\s+/, 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
        startTime = new Date(formattedTimeStr);
      }

      if (!startTime || isNaN(startTime.getTime())) {
        return;
      }

      // Parse duration HH:mm
      let durationSeconds = 6000; // default 100 mins
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
        title,
        url: fullUrl,
        startTime,
        endTime,
        durationSeconds,
        status: startMs <= now && endMs >= now ? 'CODING' : 'BEFORE',
      });
    });

    if (contests.length > 0) return contests;

    console.warn('[AtCoder Service] Official contest page returned no contests; trying Kontests.net.');
    return await fetchAtCoderFromKontests();
  } catch (error) {
    console.warn('[AtCoder Service] Official page failed; trying Kontests.net:', error.message);
    try {
      return await fetchAtCoderFromKontests();
    } catch (fallbackError) {
      console.error('[AtCoder Service] Kontests fallback failed:', fallbackError.message);
      return [];
    }
  }
}
