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
    const [cfContests, lcContests, acContests, ccContests, universalContests, unstopContests] = await Promise.all([
      fetchCodeforcesContests(),
      fetchLeetCodeContests(),
      fetchAtCoderContests(),
      fetchCodeChefContests(),
      fetchUniversalCpContests(),
      fetchUnstopContests(),
    ]);

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

    const isDbConnected = mongoose.connection.readyState === 1;

    const obsoleteAtCoderTitle = /practice|weekday|daily|training|selection|guide for beginners/i;
    const isObsoleteAtCoder = (contest) =>
      contest.platform === 'AtCoder' &&
      (obsoleteAtCoderTitle.test(contest.title) || new Date(contest.startTime).getTime() < 946684800000);

    for (const [cacheKey, contest] of inMemoryContests) {
      if (isObsoleteAtCoder(contest)) inMemoryContests.delete(cacheKey);
    }

    if (isDbConnected) {
      await Contest.deleteMany({
        platform: 'AtCoder',
        $or: [
          { title: { $regex: obsoleteAtCoderTitle } },
          { startTime: { $lt: new Date('2000-01-01T00:00:00.000Z') } },
        ],
      });
    }

    // Remove AtCoder records from older scraper runs that are no longer valid main contests.
    // Do not prune when the source returned nothing, since that could be a temporary outage.
    if (acContests.length > 0) {
      const currentAtCoderIds = new Set(acContests.map((contest) => contest.contestId));
      for (const [cacheKey, contest] of inMemoryContests) {
        if (contest.platform === 'AtCoder' && !currentAtCoderIds.has(contest.contestId)) {
          inMemoryContests.delete(cacheKey);
        }
      }

      if (isDbConnected) {
        await Contest.deleteMany({
          platform: 'AtCoder',
          contestId: { $nin: Array.from(currentAtCoderIds) },
        });
      }
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
