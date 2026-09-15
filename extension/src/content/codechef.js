// Content Script for CodeChef (codechef.com)

console.log('[CP-Sync Content] CodeChef Git-Sync Script Loaded.');

let processedCodeChefSubmissions = new Set();

function initCodeChefObserver() {
  const observer = new MutationObserver(() => {
    checkCodeChefSubmission();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  checkCodeChefSubmission();
}

function checkCodeChefSubmission() {
  // Check for Accepted verdict element on CodeChef submission modal or page
  const statusElement =
    document.querySelector('.submission-status') ||
    document.querySelector('.status-cell') ||
    document.querySelector('[class*="status-accepted"]') ||
    document.querySelector('.status-container');

  if (!statusElement) return;

  const statusText = (statusElement.innerText || statusElement.textContent || '').trim();
  if (!statusText.includes('Accepted') && !statusText.includes('100 pts') && !statusText.includes('Correct Answer')) {
    return;
  }

  // Extract problem code from URL or DOM
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  let problemCode = 'CODECHEF';

  const probIndex = pathParts.indexOf('problems');
  if (probIndex !== -1 && pathParts[probIndex + 1]) {
    problemCode = pathParts[probIndex + 1];
  } else if (pathParts.length > 0) {
    problemCode = pathParts[pathParts.length - 1];
  }

  const dedupeKey = `CodeChef_${problemCode}_${Math.floor(Date.now() / 60000)}`;
  if (processedCodeChefSubmissions.has(dedupeKey)) return;
  processedCodeChefSubmissions.add(dedupeKey);

  console.log(`[CP-Sync Content] Accepted solution detected on CodeChef: ${problemCode}`);

  const code = extractCode();
  const language = extractLanguage();
  const problemTitle = problemCode.toUpperCase();

  const payload = {
    platform: 'CodeChef',
    problemId: problemCode,
    problemTitle,
    code,
    language,
    filePath: `CodeChef/${problemCode}.${getExt(language)}`,
  };

  chrome.runtime.sendMessage({ type: 'SYNC_SOLUTION', payload }, (response) => {
    if (response?.success) {
      console.log('[CP-Sync Content] CodeChef solution successfully synced to GitHub.');
    }
  });
}

function extractCode() {
  // Monaco editor / Ace editor / pre element text content
  const codeEditor =
    document.querySelector('.monaco-editor') ||
    document.querySelector('.ace_content') ||
    document.querySelector('#submission-code') ||
    document.querySelector('pre');

  if (codeEditor) {
    return codeEditor.innerText || codeEditor.textContent || '';
  }
  return '// CodeChef solution source code';
}

function extractLanguage() {
  const langElement =
    document.querySelector('.language-used') ||
    document.querySelector('[class*="language"]') ||
    document.querySelector('#language');

  if (langElement) {
    return (langElement.innerText || langElement.textContent || 'cpp').trim().toLowerCase();
  }
  return 'cpp';
}

function getExt(lang) {
  if (lang.includes('c++') || lang.includes('cpp') || lang.includes('gcc')) return 'cpp';
  if (lang.includes('java')) return 'java';
  if (lang.includes('py')) return 'py';
  if (lang.includes('js') || lang.includes('node')) return 'js';
  if (lang.includes('go')) return 'go';
  if (lang.includes('rust')) return 'rs';
  return 'cpp';
}

initCodeChefObserver();
