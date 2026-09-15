# Competitive Programming Synchronization Ecosystem

A full-stack synchronization system for Competitive Programming contests and automatic solution backup to GitHub.

---

## Architecture Components

### 1. Custom Contest API (`/backend`)
- **Node.js + Express + Mongoose (MongoDB)**: Standardized database schema for contest metadata.
- **Background Cron Engine (`node-cron`)**: Automated scrapers and API consumers fetching data every 30 minutes from:
  - **Codeforces**: Official JSON REST API (`https://codeforces.com/api/contest.list`)
  - **LeetCode**: GraphQL API (`https://leetcode.com/graphql`)
  - **AtCoder**: Cheerio HTML scraper (`https://atcoder.jp/contests/`)
- **GitHub Octokit Engine**: Endpoint `POST /api/v1/sync/github` to commit solution files and log submissions.
- **Endpoints**:
  - `GET /api/v1/contests` (filter by platform and status)
  - `POST /api/v1/contests/sync` (manually trigger fetch)
  - `POST /api/v1/sync/github` (commit solution code to GitHub)
  - `GET /health` (server health check)

---

### 2. Browser Extension (`/extension`)
- **Manifest V3 + React 18 + Vite + Tailwind CSS**.
- **Popup UI**:
  - Live countdown timers for upcoming contests.
  - Filter by platform (All, Codeforces, LeetCode, AtCoder).
  - One-click **"Add to GCal"** Google Calendar event creation button.
  - Settings panel to configure backend URL, GitHub access token, owner, and repository name.
- **Background Service Worker**: Handles background messaging, coordinates with backend API, and issues native Chrome notifications.

---

### 3. Git-Sync Content Scripts (`/extension/src/content`)
- DOM `MutationObserver` targeting LeetCode, Codeforces, and AtCoder judge result containers.
- Detects `Accepted` / `AC` verdicts in real-time.
- Automatically extracts problem title, problem ID, programming language, and source code.
- Dispatches solution payload to backend for instant GitHub commit.

---

## Quick Start Guide

### Running the Backend Server
```bash
cd backend
npm install
npm run dev
# Server will run on http://localhost:5000
```

### Building the Chrome Extension
```bash
cd extension
npm install
npm run build
```
Load the generated `extension/dist` folder into Chrome:
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select the `extension/dist` folder.
