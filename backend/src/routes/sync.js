import express from 'express';
import mongoose from 'mongoose';
import { commitSolutionToGitHub } from '../services/githubService.js';
import { Submission } from '../models/Submission.js';

const router = express.Router();

/**
 * POST /api/v1/sync/github
 * Receives solution code and metadata from content script and pushes to GitHub.
 */
router.post('/sync/github', async (req, res) => {
  try {
    const {
      token,
      owner,
      repo,
      platform,
      problemId,
      problemTitle,
      code,
      language,
      filePath,
    } = req.body;

    if (!token || !owner || !repo || !platform || !problemId || !code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters (token, owner, repo, platform, problemId, code)',
      });
    }

    const result = await commitSolutionToGitHub({
      token,
      owner,
      repo,
      platform,
      problemId,
      problemTitle: problemTitle || problemId,
      code,
      language: language || 'txt',
      filePath,
    });

    // Save log to DB if connected
    if (mongoose.connection.readyState === 1) {
      await Submission.create({
        platform,
        problemId,
        problemTitle: problemTitle || problemId,
        language: language || 'unknown',
        githubRepo: `${owner}/${repo}`,
        commitSha: result.commitSha,
        filePath: result.filePath,
      });
    }

    res.json({
      success: true,
      message: 'Solution committed to GitHub successfully',
      data: result,
    });
  } catch (error) {
    console.error('[Route POST /sync/github] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync solution to GitHub',
    });
  }
});

export default router;
