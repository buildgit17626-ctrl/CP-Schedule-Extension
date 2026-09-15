import mongoose from 'mongoose';

const contestSchema = new mongoose.Schema(
  {
    contestId: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    durationSeconds: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['BEFORE', 'CODING', 'FINISHED'],
      default: 'BEFORE',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness per contest ID per platform
contestSchema.index({ platform: 1, contestId: 1 }, { unique: true });

export const Contest = mongoose.model('Contest', contestSchema);
