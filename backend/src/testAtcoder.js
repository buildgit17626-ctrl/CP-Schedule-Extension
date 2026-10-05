import axios from 'axios';
import * as cheerio from 'cheerio';

function isMainAtCoderContest(title, slug = '') {
  if (!title) return false;
  // Clean unicode badges like Ⓐ◉ or Ⓗ◉
  const cleanTitle = title.replace(/[^\x00-\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
  const lowerTitle = cleanTitle.toLowerCase();
  const lowerSlug = (slug || '').toLowerCase();

  if (/practice|weekday|daily|training|selection|virtual/i.test(lowerTitle)) {
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

async function testScraper() {
  const res = await axios.get('https://atcoder.jp/contests/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  const $ = cheerio.load(res.data);
  const contests = [];
  const now = Date.now();

  $('table').each((_, table) => {
    $(table).find('tbody tr').each((__, tr) => {
      const tdList = $(tr).find('td');
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

      if (!rawTitle || !relUrl || !isMainAtCoderContest(rawTitle, slug)) return;

      const fullUrl = relUrl.startsWith('http') ? relUrl : `https://atcoder.jp${relUrl}`;

      let startTime = null;
      if (timeStr) {
        let formatted = timeStr.replace(/\s+/, 'T');
        if (!formatted.includes('+') && !formatted.includes('Z')) formatted += '+09:00';
        startTime = new Date(formatted);
      }

      if (!startTime || isNaN(startTime.getTime())) return;

      let durationSeconds = 6000;
      if (durationTd) {
        const parts = durationTd.text().trim().split(':');
        if (parts.length === 2) {
          durationSeconds = (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60;
        }
      }

      const startMs = startTime.getTime();
      const endMs = startMs + durationSeconds * 1000;
      if (endMs < now) return;

      contests.push({
        contestId: `ac-${slug}`,
        platform: 'AtCoder',
        title: cleanTitle,
        url: fullUrl,
        startTime,
        endTime: new Date(endMs),
        durationSeconds,
      });
    });
  });

  console.log(`FOUND ${contests.length} VALID UPCOMING ATCODER CONTESTS:`);
  console.log(JSON.stringify(contests.slice(0, 5), null, 2));
}

testScraper();
