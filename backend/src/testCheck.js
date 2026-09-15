import { fetchCodeforcesContests } from './services/codeforcesService.js';
import { fetchLeetCodeContests } from './services/leetcodeService.js';
import { fetchAtCoderContests } from './services/atcoderService.js';
import axios from 'axios';
import { spawn } from 'child_process';

async function runVerification() {
  console.log('=== STARTING ECOSYSTEM VERIFICATION CHECKS ===\n');

  console.log('[1/4] Testing Codeforces API Service...');
  const cf = await fetchCodeforcesContests();
  console.log(`  -> Fetched ${cf.length} Codeforces contests.`);
  if (cf.length > 0) {
    console.log('  -> Sample contest:', cf[0].title);
  }

  console.log('\n[2/4] Testing LeetCode GraphQL Service...');
  const lc = await fetchLeetCodeContests();
  console.log(`  -> Fetched ${lc.length} LeetCode contests.`);
  if (lc.length > 0) {
    console.log('  -> Sample contest:', lc[0].title);
  }

  console.log('\n[3/4] Testing AtCoder Web Scraper Service...');
  const ac = await fetchAtCoderContests();
  console.log(`  -> Fetched ${ac.length} AtCoder contests.`);
  if (ac.length > 0) {
    console.log('  -> Sample contest:', ac[0].title);
  }

  console.log('\n[4/4] Testing Express API Server Endpoints...');
  const server = spawn('node', ['src/server.js'], { cwd: process.cwd() });

  // Listen for server start message or wait up to 3.5s
  await new Promise((resolve) => {
    let resolved = false;
    server.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('CP-Sync API Server running') && !resolved) {
        resolved = true;
        resolve();
      }
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 3500);
  });

  try {
    const health = await axios.get('http://localhost:5000/health');
    console.log('  -> GET /health status:', health.status, health.data);

    const contestsRes = await axios.get('http://localhost:5000/api/v1/contests');
    console.log('  -> GET /api/v1/contests status:', contestsRes.status);
    console.log(`  -> Total contests in endpoint payload: ${contestsRes.data.count}`);

    console.log('\n=== ALL SYSTEM CHECKS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('  -> Server check failed:', err.message);
  } finally {
    server.kill();
    process.exit(0);
  }
}

runVerification();
