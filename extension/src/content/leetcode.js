// Content Script for LeetCode (leetcode.com)

console.log('[CP-Sync Content] LeetCode Git-Sync Script Loaded.');

let processedSubmissions = new Set();

function initLeetCodeObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        checkSubmissionStatus();
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function checkSubmissionStatus() {
  // Check for Accepted verdict element in LeetCode submission modal or page
  const resultElement =
    document.querySelector('[data-e2e-locator="submission-result"]') ||
    document.querySelector('.result-container') ||
    document.querySelector('[class*="submission-result"]') ||
    document.querySelector('[data-submission-status="ACCEPTED"]');

  if (!resultElement) return;

  const text = resultElement.innerText || '';
  if (!text.includes('Accepted')) return;

  // Extract problem title and slug from URL or DOM
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  let problemSlug = 'unknown-problem';
  let problemId = 'LC';

  const probIndex = pathParts.indexOf('problems');
  if (probIndex !== -1 && pathParts[probIndex + 1]) {
    problemSlug = pathParts[probIndex + 1];
    problemId = problemSlug;
  }

  // Deduplicate using slug + timestamp minute
  const dedupeKey = `${problemSlug}_${Math.floor(Date.now() / 60000)}`;
  if (processedSubmissions.has(dedupeKey)) return;
  processedSubmissions.add(dedupeKey);

  console.log(`[CP-Sync Content] Accepted solution detected on LeetCode: ${problemSlug}`);

  // Extract code from Monaco editor or DOM
  const code = extractCode();
  const language = extractLanguage();
  const problemTitle = formatTitle(problemSlug);

  const payload = {
    platform: 'LeetCode',
    problemId,
    problemTitle,
    code,
    language,
    filePath: `LeetCode/${problemSlug}.${getExt(language)}`,
  };

  chrome.runtime.sendMessage({ type: 'SYNC_SOLUTION', payload }, (response) => {
    if (response?.success) {
      console.log('[CP-Sync Content] LeetCode solution successfully synced to GitHub.');
    }
  });
}

function extractCode() {
  // Try extracting code lines from Monaco Editor
  const lineElements = document.querySelectorAll('.monaco-editor .view-line');
  if (lineElements.length > 0) {
    return Array.from(lineElements)
      .map((el) => el.textContent || '')
      .join('\n');
  }

  // Fallback to code tag or pre element
  const codePre = document.querySelector('pre code') || document.querySelector('code');
  if (codePre) {
    return codePre.textContent || '';
  }

  return '// Unable to extract code content automatically.';
}

function extractLanguage() {
  // Check language selector DOM element
  const langBtn = document.querySelector('[id*="language-select"]') || document.querySelector('button[id*="lang"]');
  if (langBtn) {
    return langBtn.textContent.trim().toLowerCase();
  }
  return 'cpp';
}

function formatTitle(slug) {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getExt(lang) {
  const map = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    python3: 'py',
    cpp: 'cpp',
    'c++': 'cpp',
    java: 'java',
    golang: 'go',
    rust: 'rs',
  };
  return map[lang.toLowerCase()] || 'txt';
}

initLeetCodeObserver();
