import axios from 'axios';

import * as cheerio from 'cheerio';

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

    // Tables: #contest-table-upcoming, #contest-table-action (active)
    $('#contest-table-upcoming tbody tr, #contest-table-action tbody tr').each((_, element) => {
      const tdList = $(element).find('td');
      if (tdList.length < 2) return;

      const timeTd = $(tdList[0]);
      const titleTd = $(tdList[1]);
      const durationTd = tdList.length >= 3 ? $(tdList[2]) : null;

      const timeStr = timeTd.find('a').text().trim(); // e.g. 2026-09-20 21:00:00+0900
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
        const formattedTimeStr = timeStr.replace(' ', 'T');
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

    return contests;
  } catch (error) {
    console.error('[AtCoder Service] Error scraping contests:', error.message);
    return [];
  }
}
