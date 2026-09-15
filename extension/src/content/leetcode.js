// Content Script for LeetCode (leetcode.com)
// Strategy:
//   1. Hook "Submit" button click → capture Monaco code at that moment.
//   2. Watch for "Accepted" result badge (MutationObserver).
//   3. Send captured code + problem info to background service worker.

console.log('[CP-Sync] LeetCode content script loaded.');

let pendingLCCode = '';
let pendingLCLang = 'cpp';
let processedLCKeys = new Set();

// ─── Helper: file extension from language ──────────────────────────────────────
function getExt(lang) {
  const map = {
    'c++': 'cpp', cpp: 'cpp', c: 'c',
    java: 'java',
    python: 'py', python3: 'py', python2: 'py',
    javascript: 'js', js: 'js',
    typescript: 'ts',
    go: 'go', golang: 'go',
    rust: 'rs',
    kotlin: 'kt', swift: 'swift', scala: 'scala',
    ruby: 'rb', php: 'php', 'c#': 'cs',
  };
  return map[lang.toLowerCase()] || 'txt';
}

// ─── Capture code from Monaco editor ──────────────────────────────────────────
function captureMonacoCode() {
  // Try global monaco instance (most reliable)
  try {
    const models = window.monaco?.editor?.getModels?.();
    if (models && models.length > 0) {
      return models[0].getValue();
    }
  } catch (_) {}

  // Fallback: collect .view-line spans
  const lines = document.querySelectorAll('.monaco-editor .view-line');
  if (lines.length > 0) {
    return Array.from(lines).map(l => l.textContent).join('\n');
  }

  // Fallback: CodeMirror (older LC UI)
  const cm = document.querySelector('.CodeMirror');
  if (cm?.CodeMirror) return cm.CodeMirror.getValue();

  return '';
}

// ─── Capture current language from the toolbar dropdown ───────────────────────
function captureLanguage() {
  // LeetCode language button text
  const langBtn = document.querySelector(
    '[data-key="language"] button, ' +
    '[id*="headlessui-listbox-button"], ' +
    'button[id*="language"], ' +
    '.ant-select-selection-item'
  );
  if (langBtn) {
    const txt = langBtn.textContent.trim().toLowerCase().split('(')[0].trim();
    if (txt) return txt;
  }
  // Fallback: look for <button> containing known language names
  const allBtns = document.querySelectorAll('button');
  for (const btn of allBtns) {
    const t = btn.textContent.trim().toLowerCase();
    if (['c++', 'java', 'python3', 'python', 'javascript', 'typescript', 'go', 'rust', 'kotlin', 'swift'].includes(t)) {
      return t;
    }
  }
  return 'cpp';
}

// ─── Hook the Submit button to capture code before result ─────────────────────
function hookSubmitButton() {
  // LeetCode submit button — multiple possible selectors
  const btn = document.querySelector(
    '[data-e2e-locator="console-submit-button"], ' +
    'button[data-cy="submit-code-btn"], ' +
    'button.submit__3Hf9C'
  ) || Array.from(document.querySelectorAll('button')).find(
    b => b.textContent.trim() === 'Submit' && !b.disabled
  );

  if (!btn || btn.dataset.cpHooked) return;
  btn.dataset.cpHooked = 'true';

  btn.addEventListener('click', () => {
    pendingLCCode = captureMonacoCode();
    pendingLCLang = captureLanguage();
    console.log(`[CP-Sync] Captured LC code at submit. Lang: ${pendingLCLang}, length: ${pendingLCCode.length}`);
  });
}

// ─── Detect Accepted verdict and fire sync ─────────────────────────────────────
function processLeetCodeSubmission() {
  // Try multiple selectors for the accepted badge
  const accepted =
    document.querySelector('[data-e2e-locator="submission-result"]') ||
    document.querySelector('.text-green-s') ||
    Array.from(document.querySelectorAll('span, div, p')).find(
      el => el.textContent.trim() === 'Accepted' &&
            (el.className?.includes('green') || el.closest('[class*="accepted"]'))
    );

  if (!accepted) return;
  if (!accepted.textContent.includes('Accepted')) return;
  if (accepted.dataset.cpSynced === 'true') return;
  accepted.dataset.cpSynced = 'true';

  // Extract problem slug from URL
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const probIdx = pathParts.indexOf('problems');
  const problemSlug = probIdx !== -1 && pathParts[probIdx + 1]
    ? pathParts[probIdx + 1]
    : 'leetcode-problem';

  const dedupeKey = `LC_${problemSlug}_${Math.floor(Date.now() / 60000)}`;
  if (processedLCKeys.has(dedupeKey)) return;
  processedLCKeys.add(dedupeKey);

  const problemTitle = problemSlug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Use captured code, fall back to re-reading Monaco
  const code = pendingLCCode || captureMonacoCode() ||
    `// LeetCode: ${problemSlug}\n// Language: ${pendingLCLang}`;
  const language = pendingLCLang || captureLanguage();

  // Reset for next submission
  pendingLCCode = '';

  console.log(`[CP-Sync] LeetCode Accepted: ${problemSlug}, code length: ${code.length}`);

  chrome.runtime.sendMessage({
    type: 'SYNC_SOLUTION',
    payload: {
      platform: 'LeetCode',
      problemId: problemSlug,
      problemTitle,
      language,
      code,
      filePath: `LeetCode/${problemSlug}.${getExt(language)}`,
    },
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[CP-Sync] Message error:', chrome.runtime.lastError.message);
      return;
    }
    if (response?.success) {
      console.log('[CP-Sync] LeetCode solution synced to GitHub successfully.');
    } else {
      console.warn('[CP-Sync] LeetCode sync error:', response?.error);
    }
  });
}

// ─── Re-hook submit periodically (SPA navigation) ─────────────────────────────
setInterval(hookSubmitButton, 2000);

// ─── MutationObserver ─────────────────────────────────────────────────────────
const lcObserver = new MutationObserver(() => {
  hookSubmitButton();
  processLeetCodeSubmission();
});
lcObserver.observe(document.body, { childList: true, subtree: true });

// Initial
hookSubmitButton();
processLeetCodeSubmission();
