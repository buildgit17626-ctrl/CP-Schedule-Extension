import cron from 'node-cron';
import mongoose from 'mongoose';
import { Contest } from '../models/Contest.js';
import { fetchCodeforcesContests } from '../services/codeforcesService.js';
import { fetchLeetCodeContests } from '../services/leetcodeService.js';
import { fetchAtCoderContests } from '../services/atcoderService.js';
import { fetchCodeChefContests } from '../services/codechefService.js';
import { fetchUniversalCpContests } from '../services/universalCpService.js';
import { fetchUnstopContests } from '../services/unstopService.js';

// In-memory fallback cache when MongoDB is disconnected/offline
export const inMemoryContests = new Map();

export async function syncAllContests() {
  console.log('[Cron Job] Starting contest fetch across all platforms (Codeforces, LeetCode, AtCoder, CodeChef, Unstop, HackerCup, Google)...');

  try {
    const results = await Promise.allSettled([
      fetchCodeforcesContests(),
      fetchLeetCodeContests(),
      fetchAtCoderContests(),
      fetchCodeChefContests(),
      fetchUniversalCpContests(),
      fetchUnstopContests(),
    ]);

    const [cfContests, lcContests, acContests, ccContests, universalContests, unstopContests] = results.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      console.warn(`[Cron Job] Contest source ${index + 1} failed:`, result.reason?.message || result.reason);
      return [];
    });

    const rawList = [
      ...cfContests,
      ...lcContests,
      ...acContests,
      ...ccContests,
      ...universalContests,
      ...unstopContests,
    ];

    // Deduplicate by platform + title
    const uniqueMap = new Map();
    for (const c of rawList) {
      const key = `${c.platform.toLowerCase()}_${c.title.toLowerCase().trim()}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, c);
      }
    }

    const allContests = Array.from(uniqueMap.values());
    console.log(`[Cron Job] Fetched ${allContests.length} total active/upcoming contests across all platforms.`);

    if (allContests.length === 0) {
      console.warn('[Cron Job] All contest sources returned no data; preserving the existing schedule.');
      return {
        count: 0,
        sources: {
          codeforces: cfContests.length,
          leetcode: lcContests.length,
          atcoder: acContests.length,
          codechef: ccContests.length,
          universal: universalContests.length,
          unstop: unstopContests.length,
        },
      };
    }

    const isDbConnected = mongoose.connection.readyState === 1;

    for (const contest of allContests) {
      if (isDbConnected) {
        await Contest.findOneAndUpdate(
          { platform: contest.platform, contestId: contest.contestId },
          contest,
          { upsert: true, new: true }
        );
      }
      // Keep in-memory cache updated regardless
      inMemoryContests.set(`${contest.platform}_${contest.contestId}`, contest);
    }

    console.log('[Cron Job] Sync complete successfully.');
    return {
      count: allContests.length,
      sources: {
        codeforces: cfContests.length,
        leetcode: lcContests.length,
        atcoder: acContests.length,
        codechef: ccContests.length,
        universal: universalContests.length,
        unstop: unstopContests.length,
      },
    };
  } catch (error) {
    console.error('[Cron Job] Error during contest sync:', error.message);
    throw error;
  }
}

export function initCronJobs() {
  // Run background fetch every 30 minutes
  cron.schedule('*/30 * * * *', () => {
    syncAllContests();
  });

  // Initial run on server startup
  syncAllContests();
}
