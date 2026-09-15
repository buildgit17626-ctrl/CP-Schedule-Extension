import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import contestRoutes from './routes/contests.js';
import syncRoutes from './routes/sync.js';
import { initCronJobs } from './jobs/cron.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1', contestRoutes);
app.use('/api/v1', syncRoutes);

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Express] CP-Sync API Server running on port ${PORT}`);
    console.log(`[Express] Health check: http://localhost:${PORT}/health`);
    console.log(`[Express] Contests endpoint: http://localhost:${PORT}/api/v1/contests`);
  });
}

startServer();
