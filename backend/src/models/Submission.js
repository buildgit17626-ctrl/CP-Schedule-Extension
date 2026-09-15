import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ['LeetCode', 'Codeforces', 'AtCoder'],
      required: true,
    },
    problemId: {
      type: String,
      required: true,
    },
    problemTitle: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
    },
    githubRepo: {
      type: String,
      required: true,
    },
    commitSha: {
      type: String,
    },
    filePath: {
      type: String,
      required: true,
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Submission = mongoose.model('Submission', submissionSchema);
