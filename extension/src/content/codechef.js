// Content Script for CodeChef (codechef.com)
// Detects AC verdicts and sends solution payload to background service worker.

console.log('[CP-Sync] CodeChef content script loaded.');

let processedCCKeys = new Set();
let pendingCodeChefCode = '';
let pendingCodeChefLanguage = 'cpp';

function captureCodeChefCode() {
  const textarea = document.querySelector('textarea#sourceCode, textarea[name="source"], textarea.ace_text-input');
  if (textarea?.value) return textarea.value;

  const editorLines = document.querySelectorAll('.CodeMirror-line, .monaco-editor .view-line, #editor .view-line');
  return Array.from(editorLines).map((line) => line.textContent).join('\n');
}

function hookCodeChefSubmit() {
  const submitButton = Array.from(document.querySelectorAll('button, input[type="submit"]')).find((button) => {
    const label = (button.textContent || button.value || '').trim().toLowerCase();
    return label === 'submit' || label.includes('submit solution');
  });
  if (!submitButton || submitButton.dataset.cpHooked) return;

  submitButton.dataset.cpHooked = 'true';
  submitButton.addEventListener('click', () => {
    pendingCodeChefCode = captureCodeChefCode();
    const languageSelect = document.querySelector('[data-lang], #lang_code_select, select[name="language"]');
    pendingCodeChefLanguage = languageSelect?.dataset?.lang || languageSelect?.value || 'cpp';
  });
}

function processCodeChefSubmission() {
  const acEl =
    document.querySelector('span.correct') ||
    document.querySelector('.status-AC') ||
    Array.from(document.querySelectorAll('td, span, div')).find(
      (el) => el.textContent.trim() === 'AC' || el.textContent.trim() === 'Correct Answer'
    );

  if (!acEl) return;
  if (acEl.dataset.cpSynced === 'true') return;
  acEl.dataset.cpSynced = 'true';

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const probIdx = pathParts.indexOf('problems');
  const problemId = probIdx !== -1 ? pathParts[probIdx + 1] : 'CC-Problem';

  const dedupeKey = `CC_${problemId}_${Math.floor(Date.now() / 60000)}`;
  if (processedCCKeys.has(dedupeKey)) return;
  processedCCKeys.add(dedupeKey);

  const titleEl = document.querySelector('h1.ui-title, .problem-name, h1');
  const problemTitle = titleEl ? titleEl.textContent.trim() : problemId;

  const sourceEl = document.querySelector('#editor .view-line') ? null : document.querySelector('pre.code, .code-block pre');
  let code;
  if (pendingCodeChefCode) {
    code = pendingCodeChefCode;
  } else if (document.querySelector('#editor .view-line')) {
    code = Array.from(document.querySelectorAll('#editor .view-line')).map((l) => l.textContent).join('\n');
  } else {
    code = sourceEl ? sourceEl.textContent : '';
  }

  const langEl = document.querySelector('[data-lang], #lang_code_select');
  const language = (pendingCodeChefLanguage || (langEl ? langEl.dataset.lang || langEl.value : 'cpp')).toLowerCase();

  console.log(`[CP-Sync] CodeChef AC: ${problemId} — forwarding to background...`);

  chrome.runtime.sendMessage({
    type: 'SYNC_SOLUTION',
    payload: {
      platform: 'CodeChef',
      problemId,
      problemTitle,
      language,
      code,
      filePath: `CodeChef/${problemId}.${getExt(language)}`,
    },
  }, (response) => {
    if (response?.success) {
      console.log('[CP-Sync] CodeChef solution synced to GitHub successfully.');
    } else {
      console.warn('[CP-Sync] CodeChef sync error:', response?.error);
    }
  });

  pendingCodeChefCode = '';
}

function getExt(lang) {
  if (lang.includes('c++') || lang.includes('cpp') || lang.includes('g++')) return 'cpp';
  if (lang.includes('java')) return 'java';
  if (lang.includes('py') || lang.includes('python')) return 'py';
  if (lang.includes('javascript') || lang.includes('js')) return 'js';
  if (lang.includes('go')) return 'go';
  if (lang.includes('rust')) return 'rs';
  return 'cpp';
}

const ccObserver = new MutationObserver(() => {
  hookCodeChefSubmit();
  processCodeChefSubmission();
});
ccObserver.observe(document.body, { childList: true, subtree: true });
setInterval(hookCodeChefSubmit, 2000);
hookCodeChefSubmit();
processCodeChefSubmission();
