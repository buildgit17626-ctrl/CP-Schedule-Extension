import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  _id: String, consentVersion: String, consentRevision: String, consentAt: { type: Date, index: { expires: 31536000 } },
  handles: { type: Map, of: String }, snapshots: { type: mongoose.Schema.Types.Mixed, default: {} },
  refreshedAt: { type: Date, default: null, index: true },
}, { timestamps: true });
export const SharedProfile = mongoose.model('SharedProfile', schema);
