import axios from 'axios';

const UNSTOP_API_URL = 'https://unstop.com/api/public/opportunity/search-result';
const CP_KEYWORDS = /competitive programming|programming contest|coding contest|coding[ _-]?challenge|algorithm|data structure|codeforces|leetcode|atcoder|codechef|icpc|ioi|hackerrank|\bdsa\b/i;
const UNSTOP_PAGES_TO_SCAN = 5;

function isCpCompetition(item) {
  if (!['competitions', 'hackathons'].includes(item.type)) return false;

  const searchableText = [
    item.title,
    item.subtype,
    item.details,
    ...(item.filters || []).map((filter) => filter.name),
    ...(item.workfunction || []).map((work) => work.name),
  ].join(' ');

  return CP_KEYWORDS.test(searchableText);
}

function mapUnstopOpportunity(item) {
  const startTime = new Date(item.regnRequirements?.start_regn_dt || item.created_at);
  const endTime = new Date(item.end_date || item.regnRequirements?.end_regn_dt);

  if (!item.id || !item.title || isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return null;
  }

  const now = Date.now();
  const endMs = endTime.getTime();
  if (endMs < now) return null;

  const url = item.seo_url || `https://unstop.com/${item.public_url || ''}`;
  const startMs = startTime.getTime();

  return {
    contestId: `unstop-${item.id}`,
    platform: 'Unstop',
    title: item.title,
    url,
    startTime,
    endTime,
    durationSeconds: Math.max(0, Math.floor((endMs - startMs) / 1000)),
    status: startMs <= now && endMs >= now ? 'CODING' : 'BEFORE',
  };
}

async function fetchUnstopType(type) {
  const pages = await Promise.all(
    Array.from({ length: UNSTOP_PAGES_TO_SCAN }, (_, index) => axios.get(UNSTOP_API_URL, {
      timeout: 12000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CP-Schedule-Extension/1.0',
      },
      params: {
        opportunity: type,
        opportunity_type: type,
        page: index + 1,
        per_page: 50,
      },
    }))
  );

  return pages
    .flatMap((response) => response.data?.data?.data || [])
    .filter(isCpCompetition)
    .map(mapUnstopOpportunity)
    .filter(Boolean);
}

export async function fetchUnstopContests() {
  try {
    const results = await Promise.all([fetchUnstopType('competitions')]);
    const seen = new Set();
    const contests = results.flat().filter((contest) => {
      if (seen.has(contest.contestId)) return false;
      seen.add(contest.contestId);
      return true;
    });

    console.log(`[Unstop Service] Loaded ${contests.length} active/upcoming CP competitions and coding challenges.`);
    return contests;
  } catch (error) {
    console.warn('[Unstop Service] API warning:', error.message);
    return [];
  }
}
