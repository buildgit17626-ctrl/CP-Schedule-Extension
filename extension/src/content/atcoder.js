// Content Script for AtCoder (atcoder.jp)
// Detects AC verdicts and sends the submitted source to the background worker.

console.log('[CP-Sync] AtCoder content script loaded.');

const processedACKeys = new Set();
let pendingAtCoderCode = '';
let pendingAtCoderLanguage = 'cpp';

function isAcceptedAtCoderElement(element) {
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
  return text === 'AC' ||
    element.classList.contains('label-success') ||
    element.classList.contains('status-AC');
}

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

async function fetchAtCoderSubmission(detailUrl) {
  try {
    const response = await fetch(detailUrl, { credentials: 'include' });
    if (!response.ok) return { code: '', language: '' };

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const codeElement = doc.querySelector('#submission-code, pre.linenums, pre');
    const languageElement = Array.from(doc.querySelectorAll('th')).find((header) =>
      header.textContent.trim().toLowerCase() === 'language'
    )?.nextElementSibling;

    return {
      code: codeElement?.textContent?.trim() || '',
      language: languageElement?.textContent?.trim() || '',
    };
  } catch (error) {
    console.warn('[CP-Sync] Could not fetch AtCoder submission detail:', error.message);
    return { code: '', language: '' };
  }
}

async function processAtCoderSubmission() {
  const rows = Array.from(document.querySelectorAll('table tbody tr, table tr')).filter((row) =>
    Array.from(row.querySelectorAll('span, td, a')).some(isAcceptedAtCoderElement)
  );

  for (const row of rows) {
    const acElement = Array.from(row.querySelectorAll('span, td')).find(isAcceptedAtCoderElement);
    if (!acElement || acElement.dataset.cpSynced === 'true') continue;
    acElement.dataset.cpSynced = 'true';

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const contestIndex = pathParts.indexOf('contests');
    const contestId = contestIndex >= 0 ? pathParts[contestIndex + 1] : 'atcoder';
    const taskLink = row.querySelector('td a[href*="/tasks/"]');
    const taskPath = taskLink?.getAttribute('href')?.split('/').filter(Boolean);
    const problemId = taskPath?.length ? taskPath[taskPath.length - 1] : 'problem';
    const detailLink = Array.from(row.querySelectorAll('a')).find((link) =>
      /detail/i.test(link.textContent || '')
    );
    const detailUrl = detailLink?.href || '';
    const dedupeKey = `AC_${detailUrl || `${contestId}_${problemId}`}`;
    if (processedACKeys.has(dedupeKey)) continue;
    processedACKeys.add(dedupeKey);

    let code = pendingAtCoderCode;
    let language = pendingAtCoderLanguage || 'cpp';
    if (!code && detailUrl) {
      const detail = await fetchAtCoderSubmission(detailUrl);
      code = detail.code;
      language = detail.language || language;
    }

    if (!code) {
      console.warn('[CP-Sync] AtCoder AC detected, but submission source could not be found.');
      continue;
    }

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
}

function getExt(language) {
  const normalized = language.toLowerCase();
  if (normalized.includes('c++') || normalized.includes('gcc') || normalized.includes('clang')) return 'cpp';
  if (normalized.includes('java')) return 'java';
  if (normalized.includes('py') || normalized.includes('python')) return 'py';
  if (normalized.includes('javascript') || normalized.includes('node')) return 'js';
  if (normalized.includes('go')) return 'go';
  if (normalized.includes('rust')) return 'rs';
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
