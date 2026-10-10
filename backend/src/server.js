import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import contestRoutes from './routes/contests.js';
import { initCronJobs } from './jobs/cron.js';
import { rateLimit } from './middleware/rateLimit.js';
import profileRoutes from './routes/profiles.js';
import { fileURLToPath } from 'node:url';
import cron from 'node-cron';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(proxyHops) && proxyHops > 0 && proxyHops <= 5) app.set('trust proxy', proxyHops);
app.use('/api', rateLimit());
app.use(express.json());

// Routes
app.use('/api/v1', contestRoutes);
app.use('/api/v1', profileRoutes);
const adminAssets = fileURLToPath(new URL('../public/', import.meta.url));
app.get('/admin', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.set('Referrer-Policy', 'no-referrer');
  res.sendFile('admin.html', { root: adminAssets });
});
app.use('/admin-assets', express.static(adminAssets, { index: false, dotfiles: 'deny' }));
// Backups now go directly from the extension to GitHub; never relay credentials.
app.post('/api/v1/sync/github', (_req, res) => res.status(410).json({ success: false, error: 'Update the extension to use direct GitHub backups.' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'CP Sync Custom Contest API',
  });
});

async function startServer() {
  await connectDB();
  initCronJobs();
  cron.schedule('* * * * *', () => profileRoutes.refreshNext().catch(() => console.warn('[Profiles] Refresh will retry later.')), { noOverlap: true, timezone: 'UTC' });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Express] CP-Sync API Server running on port ${PORT}`);
    console.log(`[Express] Health check: http://localhost:${PORT}/health`);
    console.log(`[Express] Contests endpoint: http://localhost:${PORT}/api/v1/contests`);
  });
}

startServer();
