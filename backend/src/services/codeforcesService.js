import axios from 'axios';

export async function fetchCodeforcesContests() {
  try {
    const response = await axios.get('https://codeforces.com/api/contest.list?gym=false', {
      timeout: 10000,
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Codeforces API returned status: ${response.data.status}`);
    }

    const contests = response.data.result;

    // Filter upcoming (BEFORE) or currently running (CODING) contests
    const activeUpcoming = contests.filter(
      (c) => c.phase === 'BEFORE' || c.phase === 'CODING'
    );

    return activeUpcoming.map((c) => {
      const startTime = new Date(c.startTimeSeconds * 1000);
      const durationSeconds = c.durationSeconds;
      const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

      return {
        contestId: `cf-${c.id}`,
        platform: 'Codeforces',
        title: c.name,
        url: `https://codeforces.com/contests/${c.id}`,
        startTime,
        endTime,
        durationSeconds,
        status: c.phase === 'CODING' ? 'CODING' : 'BEFORE',
      };
    });
  } catch (error) {
    console.error('[Codeforces Service] Error fetching contests:', error.message);
    return [];
  }
}
