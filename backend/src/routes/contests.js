import express from 'express';
import mongoose from 'mongoose';
import { Contest } from '../models/Contest.js';
import { inMemoryContests, syncAllContests } from '../jobs/cron.js';

const router = express.Router();

/**
 * GET /api/v1/contests
 * Serves upcoming and active competitive programming contests.
 */
router.get('/contests', async (req, res) => {
  try {
    const { platform, status } = req.query;
    const isDbConnected = mongoose.connection.readyState === 1;

    let contests = [];

    if (isDbConnected) {
      const query = {};
      if (platform) {
        query.platform = new RegExp(`^${platform}$`, 'i');
      }

      // Default filter: hide finished contests unless specified
      if (status) {
        query.status = status;
      } else {
        query.status = { $in: ['BEFORE', 'CODING'] };
      }

      contests = await Contest.find(query).sort({ startTime: 1 }).lean();
    } else {
      // Memory fallback
      contests = Array.from(inMemoryContests.values());

      if (platform) {
        contests = contests.filter(
          (c) => c.platform.toLowerCase() === platform.toLowerCase()
        );
      }

      if (status) {
        contests = contests.filter((c) => c.status === status);
      } else {
        contests = contests.filter((c) => c.status === 'BEFORE' || c.status === 'CODING');
      }

      contests.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    }

    res.json({
      success: true,
      count: contests.length,
      data: contests,
    });
  } catch (error) {
    console.error('[Route GET /contests] Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve contests' });
  }
});

/**
 * POST /api/v1/contests/sync
 * Manually trigger background sync.
 */
router.post('/contests/sync', async (req, res) => {
  try {
    const result = await syncAllContests();
    res.json({ success: true, message: 'Sync triggered successfully', ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
