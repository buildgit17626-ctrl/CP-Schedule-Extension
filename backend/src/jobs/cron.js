import cron from 'node-cron';
import mongoose from 'mongoose';
import { Contest } from '../models/Contest.js';
import { fetchCodeforcesContests } from '../services/codeforcesService.js';
import { fetchLeetCodeContests } from '../services/leetcodeService.js';
import { fetchCodeChefContests } from '../services/codechefService.js';
import { fetchUniversalCpContests } from '../services/universalCpService.js';
import { fetchUnstopContests } from '../services/unstopService.js';
import { fetchKattisContests } from '../services/kattisService.js';

// In-memory fallback cache when MongoDB is disconnected/offline
export const inMemoryContests = new Map();

export async function syncAllContests() {
  console.log('[Cron Job] Starting contest fetch across all platforms (Codeforces, LeetCode, CodeChef, Kattis, Unstop, HackerCup, Google)...');

  try {
    const [cfContests, lcContests, ccContests, universalContests, unstopContests, kattisContests] = await Promise.all([
      fetchCodeforcesContests(),
      fetchLeetCodeContests(),
      fetchCodeChefContests(),
      fetchUniversalCpContests(),
      fetchUnstopContests(),
      fetchKattisContests(),
    ]);

    const rawList = [
      ...cfContests,
      ...lcContests,
      ...acContests,
      ...ccContests,
      ...universalContests,
      ...unstopContests,
      ...kattisContests,
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

    const isDbConnected = mongoose.connection.readyState === 1;

    for (const [cacheKey, contest] of inMemoryContests) {
      if (contest.platform === 'AtCoder') inMemoryContests.delete(cacheKey);
    }

    if (isDbConnected) {
      await Contest.deleteMany({ platform: 'AtCoder' });
    }

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
  } catch (error) {
    console.error('[Cron Job] Error during contest sync:', error.message);
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
