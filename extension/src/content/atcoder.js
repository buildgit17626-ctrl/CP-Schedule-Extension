// Content Script for AtCoder (atcoder.jp)
// Detects AC verdicts and sends solution payload to background service worker.

console.log('[CP-Sync] AtCoder content script loaded.');

let processedACKeys = new Set();
let pendingAtCoderCode = '';
let pendingAtCoderLanguage = 'cpp';

function captureAtCoderCode() {
  const textarea = document.querySelector('textarea#sourceCode, textarea[name="sourceCode"], textarea[name="source"]');
  if (textarea?.value) return textarea.value;

  const editorLines = document.querySelectorAll('.CodeMirror-line, .monaco-editor .view-line');
  return Array.from(editorLines).map((line) => line.textContent).join('\n');
}

function hookAtCoderSubmit() {
  const submitButton = document.querySelector(
    '#submit-form input[type="submit"], form#submit-form button[type="submit"], input[type="submit"]'
  );
  if (!submitButton || submitButton.dataset.cpHooked) return;

  submitButton.dataset.cpHooked = 'true';
  submitButton.addEventListener('click', () => {
    pendingAtCoderCode = captureAtCoderCode();
    const languageSelect = document.querySelector('#select-lang, select[name="lang"]');
    pendingAtCoderLanguage = languageSelect?.selectedOptions?.[0]?.textContent?.trim() || 'cpp';
  });
}

function processAtCoderSubmission() {
  const acSpan = document.querySelector('span.label-success, td span.label.label-success');
  if (!acSpan || acSpan.textContent.trim() !== 'AC') return;

  if (acSpan.dataset.cpSynced === 'true') return;
  acSpan.dataset.cpSynced = 'true';

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  let contestId = 'atcoder';
  let problemId = 'problem';

  if (pathParts.includes('contests')) contestId = pathParts[pathParts.indexOf('contests') + 1];
  if (pathParts.includes('tasks')) problemId = pathParts[pathParts.indexOf('tasks') + 1];
  else problemId = contestId;

  const dedupeKey = `AC_${contestId}_${problemId}_${Math.floor(Date.now() / 60000)}`;
  if (processedACKeys.has(dedupeKey)) return;
  processedACKeys.add(dedupeKey);

  const codePre = document.querySelector('#submission-code') || document.querySelector('pre.linenums') || document.querySelector('pre');
  const code = pendingAtCoderCode || (codePre ? codePre.textContent : '');

  let language = pendingAtCoderLanguage || 'cpp';
  document.querySelectorAll('th').forEach((th) => {
    if (th.textContent.includes('Language')) {
      const td = th.nextElementSibling;
      if (td) language = td.textContent.trim().toLowerCase();
    }
  });

  console.log(`[CP-Sync] AtCoder AC: ${contestId}/${problemId} — forwarding to background...`);

  chrome.runtime.sendMessage({
    type: 'SYNC_SOLUTION',
    payload: {
      platform: 'AtCoder',
      problemId,
      problemTitle: `${contestId.toUpperCase()} - ${problemId.toUpperCase()}`,
      language,
      code,
      filePath: `AtCoder/${contestId}/${problemId}.${getExt(language)}`,
    },
  }, (response) => {
    if (response?.success) {
      console.log('[CP-Sync] AtCoder solution synced to GitHub successfully.');
    } else {
      console.warn('[CP-Sync] AtCoder sync error:', response?.error);
    }
  });

  pendingAtCoderCode = '';
}

function getExt(lang) {
  if (lang.includes('c++') || lang.includes('gcc') || lang.includes('clang')) return 'cpp';
  if (lang.includes('java')) return 'java';
  if (lang.includes('py') || lang.includes('python')) return 'py';
  if (lang.includes('javascript') || lang.includes('node')) return 'js';
  if (lang.includes('go')) return 'go';
  if (lang.includes('rust')) return 'rs';
  return 'cpp';
}

const acObserver = new MutationObserver(() => {
  hookAtCoderSubmit();
  processAtCoderSubmission();
});
acObserver.observe(document.body, { childList: true, subtree: true });
setInterval(hookAtCoderSubmit, 2000);
hookAtCoderSubmit();
processAtCoderSubmission();
