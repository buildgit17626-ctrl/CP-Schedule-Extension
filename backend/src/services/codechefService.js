import axios from 'axios';

export async function fetchCodeChefContests() {
  try {
    const response = await axios.get('https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    const data = response.data;
    const futureContests = data.future_contests || [];
    const presentContests = data.present_contests || [];
    const rawContests = [...presentContests, ...futureContests];

    const now = Date.now();
    const contests = [];

    for (const c of rawContests) {
      if (!c.contest_code || !c.contest_name) continue;

      const startTime = new Date(c.contest_start_date_iso || c.contest_start_date);
      const endTime = new Date(c.contest_end_date_iso || c.contest_end_date);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) continue;

      const startMs = startTime.getTime();
      const endMs = endTime.getTime();
      const durationSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

      contests.push({
        contestId: `codechef-${c.contest_code.toLowerCase()}`,
        platform: 'CodeChef',
        title: c.contest_name,
        url: `https://www.codechef.com/${c.contest_code}`,
        startTime,
        endTime,
        durationSeconds,
        status: startMs <= now && endMs >= now ? 'CODING' : 'BEFORE',
      });
    }

    return contests;
  } catch (error) {
    console.error('[CodeChef Service] Error fetching contests:', error.message);
    return [];
  }
}
