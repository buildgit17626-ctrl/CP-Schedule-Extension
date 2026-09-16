// Background Service Worker for Manifest V3 extension

const PERIODIC_SYNC_ALARM = 'periodicContestSync';

async function ensurePeriodicSyncAlarm() {
  const existingAlarm = await chrome.alarms.get(PERIODIC_SYNC_ALARM);
  if (!existingAlarm) {
    await chrome.alarms.create(PERIODIC_SYNC_ALARM, { periodInMinutes: 30 });
    console.log('[CP-Sync Background] Created 30-minute contest sync alarm.');
  }
}

// Recreate the alarm for existing installations as well as fresh installs.
chrome.runtime.onInstalled.addListener(() => {
  console.log('[CP-Sync Background] Extension installed or updated. Extension ID:', chrome.runtime.id);
  ensurePeriodicSyncAlarm();
  triggerAutomaticCalendarSync().catch((error) => {
    console.warn('[CP-Sync Background] Initial calendar sync skipped:', error.message);
  });
});

chrome.runtime.onStartup.addListener(() => {
  ensurePeriodicSyncAlarm();
});

ensurePeriodicSyncAlarm();

// Alarm event listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === PERIODIC_SYNC_ALARM) {
    console.log('[CP-Sync Background] 30-minute alarm triggered. Running automatic calendar sync...');
    triggerAutomaticCalendarSync();
  }
});

// Listener for runtime messages from Popup UI or Content Scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const actionType = request.type || request.action;

  if (actionType === 'SYNC_SOLUTION' || actionType === 'syncSolution') {
    handleSolutionSync(request.payload)
      .then((res) => sendResponse({ success: true, data: res }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep async response channel open
  }

  if (actionType === 'FORCE_CALENDAR_SYNC' || actionType === 'forceCalendarSync') {
    triggerAutomaticCalendarSync()
      .then((count) => sendResponse({ success: true, syncedCount: count }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (actionType === 'AUTHENTICATE_GOOGLE_CALENDAR') {
    clearAndAuthenticateGoogleOAuth()
      .then((token) => {
        if (token) {
          sendResponse({ success: true, token });
          triggerAutomaticCalendarSync().catch((error) => {
            console.warn('[CP-Sync Background] Automatic sync after Google connection failed:', error.message);
          });
        } else {
          sendResponse({
            success: false,
            error: `Google OAuth returned no token. Current Extension ID: ${chrome.runtime.id}`,
          });
        }
      })
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Clears any cached identity tokens and requests fresh Google OAuth authentication.
 */
async function clearAndAuthenticateGoogleOAuth() {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.clearAllCachedTokens) {
      chrome.identity.clearAllCachedTokens(() => {
        authenticateGoogleOAuth(true).then(resolve).catch(reject);
      });
    } else {
      authenticateGoogleOAuth(true).then(resolve).catch(reject);
    }
  });
}

/**
 * Automatically fetches upcoming contests from backend and injects new events directly into Google Calendar.
 */
export async function triggerAutomaticCalendarSync() {
  try {
    const config = await getStoredConfig();
    const backendUrl = (config.backendUrl || 'https://cp-schedule-extension.onrender.com').replace(/\/+$/, '');
    const autoGCalSync = config.autoGCalSync ?? true;

    if (!autoGCalSync) {
      console.log('[CP-Sync Background] Automatic Google Calendar sync is disabled in settings.');
      return 0;
    }

    // 1. Fetch upcoming contests from Custom Contest API
    const response = await fetch(`${backendUrl}/api/v1/contests`);
    if (!response.ok) {
      throw new Error(`Backend API returned HTTP ${response.status}`);
    }
    const result = await response.json();
    const contests = result.data || [];

    if (contests.length === 0) {
      console.log('[CP-Sync Background] No upcoming contests found to sync.');
      return 0;
    }

    // 2. Get Google OAuth Token (silent interactive: false first)
    const token = await authenticateGoogleOAuth(false);
    if (!token) {
      throw new Error('Google Calendar is not connected. Open Settings and click Connect Google Account.');
    }

    // 3. Read already synced contest IDs from storage
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get(['syncedContests'], resolve);
    });
    const syncedContests = stored.syncedContests || [];

    let newSyncedCount = 0;

    for (const contest of contests) {
      const uniqueId = `${contest.platform}-${contest.contestId}`;

      if (!syncedContests.includes(uniqueId)) {
        console.log(`[CP-Sync Background] Auto-injecting contest to Google Calendar: ${contest.title}`);
        const success = await injectEventIntoGoogleCalendar(token, contest);
        if (success) {
          syncedContests.push(uniqueId);
          newSyncedCount++;
          showNotification(
            `Calendar Auto-Sync: ${contest.platform}`,
            `Added contest "${contest.title}" directly to your Google Calendar!`
          );
        }
      }
    }

    // Save updated synced log to local storage
    await chrome.storage.local.set({ syncedContests });
    console.log(`[CP-Sync Background] Auto-sync cycle complete. Injected ${newSyncedCount} new contest events.`);
    return newSyncedCount;
  } catch (error) {
    console.error('[CP-Sync Background] Automatic contest sync failed:', error.message);
    throw error;
  }
}

/**
 * Injects a single contest event into the user's primary Google Calendar via Google Calendar API v3.
 */
function getMorningReminderMinutes(startDate) {
  const morning = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
    9,
    0,
    0,
    0
  );

  return Math.max(0, Math.round((startDate.getTime() - morning.getTime()) / 60000));
}

async function injectEventIntoGoogleCalendar(token, contest) {
  const startDate = new Date(contest.startTime);
  const endDate = new Date(contest.endTime);
  const morningReminderMinutes = getMorningReminderMinutes(startDate);

  const eventPayload = {
    summary: `[${contest.platform.toUpperCase()}] ${contest.title}`,
    description: `Competitive Programming Contest on ${contest.platform}.\nDirect link: ${contest.url}`,
    location: contest.url,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: morningReminderMinutes }],
    },
  };

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (res.status === 401) {
      console.warn('[CP-Sync Background] OAuth token expired or invalid.');
      return false;
    }

    return res.ok || res.status === 200 || res.status === 201;
  } catch (err) {
    console.error(`[CP-Sync Background] Failed to post event for ${contest.title}:`, err.message);
    return false;
  }
}

/**
 * Obtains Google OAuth Access Token via chrome.identity.getAuthToken or launchWebAuthFlow.
 */
async function authenticateGoogleOAuth(interactive = false) {
  const config = await getStoredConfig();

  // 1. Manual Access Token Override if provided
  if (config.gcalAccessToken && config.gcalAccessToken.trim().length > 0) {
    return config.gcalAccessToken.trim();
  }

  // 2. Try chrome.identity.getAuthToken
  const tokenFromGetAuthToken = await new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getAuthToken) {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message || '';
          console.warn('[CP-Sync Background] getAuthToken warning:', errMsg);
          if (interactive) {
            reject(new Error(`Google OAuth error: "${errMsg}"`));
          } else {
            resolve(null);
          }
        } else {
          resolve(token);
        }
      });
    } else {
      if (interactive) reject(new Error('chrome.identity API unavailable'));
      else resolve(null);
    }
  });

  if (tokenFromGetAuthToken) {
    return tokenFromGetAuthToken;
  }

  // 3. Fallback: launchWebAuthFlow
  if (!interactive) return null;

  const clientId = '1032167134786-3blueeern6smt9bdoap2lhm1mujrl24k.apps.googleusercontent.com';
  const redirectUri = typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getRedirectURL
    ? chrome.identity.getRedirectURL()
    : `https://${chrome.runtime.id}.chromiumapp.org/`;

  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`OAuth Error: ${chrome.runtime.lastError.message}`));
      } else if (!redirectUrl) {
        reject(new Error('Google OAuth popup closed.'));
      } else {
        try {
          const hash = redirectUrl.split('#')[1];
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          if (accessToken) {
            chrome.storage.sync.set({ gcalAccessToken: accessToken });
            resolve(accessToken);
          } else {
            reject(new Error('Access token missing from Google OAuth response.'));
          }
        } catch (err) {
          reject(new Error(`Failed to parse OAuth callback: ${err.message}`));
        }
      }
    });
  });
}

/**
 * Handles solution backup to GitHub repository via backend server.
 */
async function handleSolutionSync(payload) {
  const config = await getStoredConfig();
  const backendUrl = (config.backendUrl || 'https://cp-schedule-extension.onrender.com').replace(/\/+$/, '');
  const token = config.githubToken;
  const owner = config.githubOwner;
  const repo = config.githubRepo;
  const autoSync = config.autoSync ?? true;

  if (!autoSync) {
    console.log('[CP-Sync Background] Auto-Sync disabled in settings.');
    return { skipped: true, reason: 'Auto-Sync disabled' };
  }

  if (!token || !owner || !repo) {
    showNotification(
      'CP-Sync Configuration Error',
      'Please open extension settings and configure your GitHub token, owner, and repository.'
    );
    throw new Error('Missing GitHub settings (token, owner, or repo)');
  }

  const code = typeof payload?.code === 'string' ? payload.code.trim() : '';
  if (!code || /code not captured|code not available|source not captured/i.test(code)) {
    showNotification(
      'GitHub Sync Skipped',
      'The accepted submission was detected, but its source code was not available.'
    );
    throw new Error('Accepted submission source code was not captured');
  }

  const extMap = { cpp: 'cpp', python: 'py', python3: 'py', javascript: 'js', java: 'java', go: 'go', rust: 'rs' };
  const langExt = extMap[(payload.language || '').toLowerCase()] || 'txt';
  const defaultPath = `${payload.platform}/${payload.problemId}.${langExt}`;

  const requestBody = {
    token,
    owner,
    repo,
    platform: payload.platform,
    problemId: payload.problemId,
    problemTitle: payload.problemTitle || payload.problemId,
    code,
    language: payload.language || 'cpp',
    filePath: payload.filePath || defaultPath,
  };

  console.log(`[CP-Sync Background] Sending solution payload to cloud backend (${backendUrl}/api/v1/sync/github)...`);

  const res = await fetch(`${backendUrl}/api/v1/sync/github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to sync with backend');
  }

  showNotification(
    `Synced to GitHub: ${payload.platform}`,
    `Successfully committed ${payload.problemId} - ${payload.problemTitle} to ${owner}/${repo}!`
  );

  return data;
}

function getStoredConfig() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const keys = ['backendUrl', 'githubToken', 'githubOwner', 'githubRepo', 'autoSync', 'autoGCalSync', 'gcalAccessToken'];
      if (chrome.storage.sync) {
        chrome.storage.sync.get(keys, (syncRes) => {
          chrome.storage.local.get(keys, (localRes) => {
            resolve({ ...syncRes, ...localRes });
          });
        });
      } else {
        chrome.storage.local.get(keys, resolve);
      }
    } else {
      resolve({});
    }
  });
}

function showNotification(title, message) {
  if (typeof chrome !== 'undefined' && chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%236366f1" stroke-width="2"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>',
      title: title,
      message: message,
    });
  }
}
