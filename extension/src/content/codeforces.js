// Content Script for Codeforces (codeforces.com)

console.log('[CP-Sync Content] Codeforces Git-Sync Script Loaded.');

let processedCFSubmissions = new Set();

function initCodeforcesObserver() {
  const observer = new MutationObserver(() => {
    checkCFSubmissionStatus();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  checkCFSubmissionStatus();
}

function checkCFSubmissionStatus() {
  // Check for Accepted / OK verdict elements
  const acceptedElements = document.querySelectorAll(
    '.verdict-accepted, span.cell-passed, span[submissionverdict="OK"]'
  );

  if (acceptedElements.length === 0) return;

  // Extract problem name & ID from URL or page structure
  // URL pattern: codeforces.com/contest/1920/problem/A or codeforces.com/problemset/problem/1920/A
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  let problemId = 'CF-Problem';
  let contestId = '';
  let index = '';

  if (pathParts.includes('contest') && pathParts.includes('problem')) {
    contestId = pathParts[pathParts.indexOf('contest') + 1];
    index = pathParts[pathParts.indexOf('problem') + 1];
    problemId = `${contestId}${index}`;
  } else if (pathParts.includes('problemset') && pathParts.includes('problem')) {
    contestId = pathParts[pathParts.indexOf('problem') + 1];
    index = pathParts[pathParts.indexOf('problem') + 2];
    problemId = `${contestId}${index}`;
  }

  const titleEl = document.querySelector('.problem-statement .title') || document.querySelector('.title');
  const problemTitle = titleEl ? titleEl.textContent.trim() : problemId;

  const dedupeKey = `CF_${problemId}_${Math.floor(Date.now() / 60000)}`;
  if (processedCFSubmissions.has(dedupeKey)) return;
  processedCFSubmissions.add(dedupeKey);

  console.log(`[CP-Sync Content] Accepted solution detected on Codeforces: ${problemId}`);

  // Extract code content
  const codeEl = document.querySelector('#program-source-text') || document.querySelector('pre.prettyprint');
  const code = codeEl ? codeEl.textContent : '// Codeforces solution source';

  // Extract language
  let language = 'cpp';
  const langTd = document.querySelector('td.lang') || document.querySelector('.table-form td');
  if (langTd) {
    language = langTd.textContent.trim().toLowerCase();
  }

  const payload = {
    platform: 'Codeforces',
    problemId,
    problemTitle,
    code,
    language,
    filePath: `Codeforces/${problemId}.${getExt(language)}`,
  };

  chrome.runtime.sendMessage({ type: 'SYNC_SOLUTION', payload }, (response) => {
    if (response?.success) {
      console.log('[CP-Sync Content] Codeforces solution successfully synced to GitHub.');
    }
  });
}

function getExt(lang) {
  if (lang.includes('c++') || lang.includes('g++') || lang.includes('clang++')) return 'cpp';
  if (lang.includes('java')) return 'java';
  if (lang.includes('python') || lang.includes('pypy')) return 'py';
  if (lang.includes('javascript')) return 'js';
  if (lang.includes('go')) return 'go';
  return 'cpp';
}

initCodeforcesObserver();
