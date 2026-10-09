import express from 'express';
import mongoose from 'mongoose';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { SharedProfile } from '../models/SharedProfile.js';
import { CONSENT_VERSION, validateHandles, fetchPublicProfile } from '../services/profileService.js';
import { rateLimit } from '../middleware/rateLimit.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const bearer = req => /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(req.get('Authorization') || '')?.[1];
const repository = {
  ready: () => mongoose.connection.readyState === 1,
  save: (id, record) => SharedProfile.findOneAndUpdate({ _id: id }, { $set: record }, { upsert: true, new: true }).lean(),
  remove: id => SharedProfile.deleteOne({ _id: id }),
  get: id => SharedProfile.findOne({ _id: id, consentVersion: CONSENT_VERSION, consentAt: { $gt: new Date(Date.now() - 31536000000) } }).lean(),
  page: cursor => SharedProfile.find({ ...(cursor ? { _id: { $gt: cursor } } : {}), consentVersion: CONSENT_VERSION, consentAt: { $gt: new Date(Date.now() - 31536000000) } }).sort({ _id: 1 }).limit(21).lean(),
  refresh: (id, consentRevision, snapshots) => SharedProfile.updateOne({ _id: id, consentRevision }, { $set: { snapshots, refreshedAt: new Date() } }),
};
export function createProfileRouter({ store = repository, fetchProfile = fetchPublicProfile, enabled = () => process.env.PROFILE_SHARING_ENABLED === 'true', adminKey = () => process.env.PROFILE_ADMIN_KEY } = {}) {
  const router = express.Router(), active = new Map();
  router.get('/profile-sharing/status', (_req, res) => {
    const key = adminKey();
    const reason = !enabled() ? 'not_enabled' : !store.ready() ? 'database_unavailable' : !key || !/^[A-Za-z0-9_-]{43,128}$/.test(key) ? 'admin_not_configured' : null;
    res.set('Cache-Control', 'no-store').json({ success: true, data: { available: !reason, reason, consentVersion: CONSENT_VERSION } });
  });
  router.use(['/profile-sharing', '/admin/profiles'], (req, res, next) => { res.set('Cache-Control', 'no-store'); if ((!enabled() && !(req.method === 'DELETE' && req.originalUrl.split('?')[0].endsWith('/profile-sharing'))) || !store.ready()) return res.status(503).json({ success: false, error: 'Profile sharing is not available yet.' }); next(); });
  router.use('/profile-sharing', (req, res, next) => {
    const token = bearer(req); if (!token) return res.status(401).json({ success: false, error: 'Profile access required.' });
    req.profileId = hash(token); next();
  });
  router.put('/profile-sharing', rateLimit({ limit: 10, windowMs: 3600000 }), async (req, res) => {
    try {
      if (req.body.consent !== true || req.body.consentVersion !== CONSENT_VERSION) return res.status(400).json({ success: false, error: 'Explicit current consent is required.' });
      const handles = validateHandles(req.body.handles);
      const consentAt = new Date();
      await store.save(req.profileId, { handles, consentVersion: CONSENT_VERSION, consentRevision: randomUUID(), consentAt, snapshots: {}, refreshedAt: null });
      res.json({ success: true, data: { consentVersion: CONSENT_VERSION, consentAt, handles } });
    } catch (error) { res.status(error.message.startsWith('Enter') || error.message.startsWith('Invalid') ? 400 : 503).json({ success: false, error: 'Could not save profile sharing. Check handles and try again.' }); }
  });
  router.delete('/profile-sharing', async (req, res) => {
    try { await store.remove(req.profileId); res.json({ success: true, data: { removed: true } }); }
    catch { res.status(503).json({ success: false, error: 'Deletion failed. Please retry.' }); }
  });
  router.use('/admin/profiles', (req, res, next) => {
    const key = adminKey(), token = bearer(req);
    if (!key || key.length < 43) return res.status(503).json({ success: false, error: 'Admin access is not configured.' });
    if (!token || !timingSafeEqual(Buffer.from(hash(key)), Buffer.from(hash(token)))) return res.status(401).json({ success: false, error: 'Admin authentication required.' });
    next();
  });
  router.get('/admin/profiles', async (req, res) => {
    if (req.query.cursor && !/^[a-f0-9]{64}$/.test(req.query.cursor)) return res.status(400).json({ success: false, error: 'Invalid cursor.' });
    try {
      const records = await store.page(req.query.cursor);
      res.json({ success: true, data: { items: records.slice(0, 20), cursor: records.length > 20 ? records[19]._id : null } });
    } catch { res.status(503).json({ success: false, error: 'Profile list unavailable.' }); }
  });
  router.post('/admin/profiles/:id/refresh', async (req, res) => {
    if (!/^[a-f0-9]{64}$/.test(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid profile.' });
    try {
      const record = await store.get(req.params.id);
      if (!record) return res.status(404).json({ success: false, error: 'Profile no longer shared.' });
      if (record.refreshedAt && Date.now() - new Date(record.refreshedAt).getTime() < 86400000) return res.json({ success: true, data: record });
      if (!active.has(record._id)) {
        if (active.size >= 10) return res.status(429).json({ success: false, error: 'Too many profile refreshes.' });
        active.set(record._id, (async () => {
          const results = await Promise.all(Object.entries(record.handles).map(async ([platform, handle]) => [platform, await fetchProfile(platform, handle)]));
          await store.refresh(record._id, record.consentRevision, Object.fromEntries(results));
        })().finally(() => active.delete(record._id)));
      }
      await active.get(record._id);
      res.json({ success: true, data: await store.get(record._id) });
    } catch { res.status(503).json({ success: false, error: 'Profile refresh failed. Try again later.' }); }
  });
  return router;
}
export default createProfileRouter();
