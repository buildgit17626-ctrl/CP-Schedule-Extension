import axios from 'axios';

export async function fetchLeetCodeContests() {
  const query = `
    query getUpcomingContests {
      upcomingContests {
        title
        titleSlug
        startTime
        duration
      }
      topTwoContests {
        title
        titleSlug
        startTime
        duration
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://leetcode.com/graphql',
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        timeout: 10000,
      }
    );

    const data = response.data?.data;
    const rawContests = [
      ...(data?.upcomingContests || []),
      ...(data?.topTwoContests || []),
    ];

    // Deduplicate by titleSlug
    const uniqueMap = new Map();
    const now = Date.now();

    for (const c of rawContests) {
      if (!c.startTime) continue;
      const startMs = c.startTime * 1000;
      const durationSeconds = c.duration || 5400; // default 1.5 hours
      const endMs = startMs + durationSeconds * 1000;

      // Only include upcoming or currently running
      if (endMs >= now) {
        uniqueMap.set(c.titleSlug, {
          contestId: `lc-${c.titleSlug}`,
          platform: 'LeetCode',
          title: c.title,
          url: `https://leetcode.com/contest/${c.titleSlug}`,
          startTime: new Date(startMs),
          endTime: new Date(endMs),
          durationSeconds,
          status: startMs <= now && endMs >= now ? 'CODING' : 'BEFORE',
        });
      }
    }

    return Array.from(uniqueMap.values());
  } catch (error) {
    console.error('[LeetCode Service] Error fetching GraphQL contests:', error.message);
    return [];
  }
}
