// Content Script for Codeforces (codeforces.com)
// Strategy:
//   1. Intercept the "Submit" button click to capture code + language from the editor BEFORE submission.
//   2. Watch for .verdict-accepted to appear in DOM (MutationObserver).
//   3. If no editor code at verdict time, fetch the individual submission page to scrape source.

console.log('[CP-Sync] Codeforces content script loaded.');

// ─── Store code captured at submit time ───────────────────────────────────────
let pendingCFPayload = null;
let processedCFKeys = new Set();
const MAX_CF_SOURCE_RETRIES = 10;

// ─── Helper: map language string → file extension ─────────────────────────────
function getExt(lang) {
  if (!lang) return 'cpp';
  const l = lang.toLowerCase();
  if (l.includes('c++') || l.includes('gcc') || l.includes('clang') || l.includes('g++')) return 'cpp';
  if (l.includes('java')) return 'java';
  if (l.includes('py') || l.includes('python')) return 'py';
  if (l.includes('javascript') || l.includes('node') || l.includes('js')) return 'js';
  if (l.includes('go')) return 'go';
  if (l.includes('rust') || l.includes('rs')) return 'rs';
  if (l.includes('kotlin')) return 'kt';
  return 'cpp';
}

// ─── Capture code from Codeforces editor (CodeMirror or plain textarea) ───────
function captureEditorCode() {
  // Try CodeMirror instance (most common on CF)
  const cmEl = document.querySelector('.CodeMirror');
  if (cmEl && cmEl.CodeMirror) {
    return cmEl.CodeMirror.getValue();
  }
  // Fallback: collect CodeMirror lines
  const lines = document.querySelectorAll('.CodeMirror-line');
  if (lines.length > 0) {
    return Array.from(lines).map(l => l.textContent).join('\n');
  }
  // Fallback: ACE editor
  if (window.ace) {
    try { return window.ace.edit('editor').getValue(); } catch (_) {}
  }
  // Fallback: plain textarea
  const ta = document.querySelector('textarea#sourceCode, textarea[name="source"]');
  if (ta) return ta.value;
  return '';
}

// ─── Intercept submit button to capture code BEFORE submission ─────────────────
function hookSubmitButton() {
  const submitBtn = document.querySelector(
    'input[type="submit"][value="Submit"], button[type="submit"], #submitSolutionForm input[type="submit"]'
  );
  if (!submitBtn || submitBtn.dataset.cpHooked) return;
  submitBtn.dataset.cpHooked = 'true';

  submitBtn.addEventListener('click', () => {
    const langEl = document.querySelector('select[name="programTypeId"], #programTypeForInvoker');
    const langText = langEl ? langEl.options[langEl.selectedIndex]?.text : 'cpp';

    const code = captureEditorCode();
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    let contestId = '';
    let problemLetter = 'A';

    if (pathParts.includes('contest') || pathParts.includes('gym')) {
      const idx = pathParts.indexOf('contest') !== -1 ? pathParts.indexOf('contest') : pathParts.indexOf('gym');
      contestId = pathParts[idx + 1] || '';
      problemLetter = pathParts[idx + 2] || 'A';
    }

    pendingCFPayload = {
      code,
      language: langText || 'cpp',
      contestId,
      problemLetter,
    };
    console.log('[CP-Sync] Captured code at submit time, length:', code.length);
  });
}

// ─── Fetch source from submission detail page if we missed editor capture ──────
async function fetchSubmissionCode(submissionUrl) {
  try {
    const url = new URL(submissionUrl, window.location.origin).href;
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) return '';
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const src = doc.querySelector('#program-source-text');
    return src ? src.textContent : '';
  } catch (e) {
    console.warn('[CP-Sync] Could not fetch CF submission page:', e.message);
    return '';
  }
}

// ─── Main: process any visible accepted verdicts ──────────────────────────────
async function processCodeforcesSubmission() {
  const acceptedRows = document.querySelectorAll(
    'tr:has(.verdict-accepted), tr:has(span[submissionverdict="OK"])'
  );

  for (const row of acceptedRows) {
    if (row.dataset.cpSynced === 'true' || row.dataset.cpProcessing === 'true') continue;
    row.dataset.cpProcessing = 'true';

    // Use the real submission link because status/profile pages do not expose a contest ID in their URL.
    const submLink = row.querySelector('a[href*="/submission/"]') || row.querySelector('td:first-child a');
    const submissionUrl = submLink?.getAttribute('href') || '';
    const submissionIdMatch = submissionUrl.match(/\/submission\/(\d+)/);
    const submissionId = submissionIdMatch?.[1] || submLink?.textContent.trim() || '';

    // Problem id
    const probCell = row.querySelector('td.problem-cell a, td:nth-child(4) a');
    const probText = probCell ? probCell.textContent.trim() : pendingCFPayload?.problemLetter || 'Problem';

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    let contestId = pendingCFPayload?.contestId || '';
    if (!contestId && pathParts.includes('contest')) {
      contestId = pathParts[pathParts.indexOf('contest') + 1] || '';
    }

    const problemId = contestId ? `${contestId}${probText}` : probText;
    const dedupeKey = `CF_${problemId}_${Math.floor(Date.now() / 60000)}`;
    if (processedCFKeys.has(dedupeKey)) continue;

    // Language
    const langCell = row.querySelector('td.lang-cell, .programming-language');
    const language = langCell
      ? langCell.textContent.trim()
      : (pendingCFPayload?.language || 'cpp');

    // Code — prefer captured, then fetch from submission page
    let code = pendingCFPayload?.code || '';
    if (!code && submissionUrl) {
      console.log('[CP-Sync] Fetching code from submission page...');
      code = await fetchSubmissionCode(submissionUrl);
    } else if (!code && submissionId && contestId) {
      code = await fetchSubmissionCode(`/contest/${contestId}/submission/${submissionId}`);
    }
    if (!code) {
      const retryCount = Number(row.dataset.cpSourceRetries || 0);
      row.dataset.cpSourceRetries = String(retryCount + 1);
      row.dataset.cpProcessing = 'false';

      if (retryCount < MAX_CF_SOURCE_RETRIES) {
        console.log(`[CP-Sync] Source code is not ready yet. Retrying in 1 second (${retryCount + 1}/${MAX_CF_SOURCE_RETRIES})...`);
        setTimeout(processCodeforcesSubmission, 1000);
      } else {
        console.warn('[CP-Sync] Source code was not available after several retries.');
      }
      continue;
    }

    // Clear pending after use
    pendingCFPayload = null;
    processedCFKeys.add(dedupeKey);

    const titleEl = document.querySelector('.problem-statement .title, .header .title');
    const problemTitle = titleEl ? titleEl.textContent.trim() : problemId;

    console.log(`[CP-Sync] Codeforces Accepted: ${problemId}, code length: ${code.length}`);
    delete row.dataset.cpProcessing;

    chrome.runtime.sendMessage({
      type: 'SYNC_SOLUTION',
      payload: {
        platform: 'Codeforces',
        problemId,
        problemTitle,
        language,
        code,
        filePath: `Codeforces/${problemId}.${getExt(language)}`,
      },
    }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        row.dataset.cpSynced = 'false';
        processedCFKeys.delete(dedupeKey);
        console.warn('[CP-Sync] Message error:', chrome.runtime.lastError?.message || response?.error || 'Unknown sync error');
        return;
      }
      if (response?.success) {
        row.dataset.cpSynced = 'true';
        console.log('[CP-Sync] Codeforces solution synced to GitHub successfully.');
      }
    });
  }
}

// ─── Hook submit button periodically (for SPAs / late-loaded forms) ───────────
function tryHookSubmit() {
  hookSubmitButton();
}
setInterval(tryHookSubmit, 2000);

// ─── MutationObserver for verdict DOM changes ─────────────────────────────────
const cfObserver = new MutationObserver(() => {
  processCodeforcesSubmission();
  tryHookSubmit();
});
cfObserver.observe(document.body, { childList: true, subtree: true });

// Initial check
tryHookSubmit();
processCodeforcesSubmission();
