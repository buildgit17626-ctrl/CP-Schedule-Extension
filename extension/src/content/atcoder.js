// Content Script for AtCoder (atcoder.jp)

console.log('[CP-Sync Content] AtCoder Git-Sync Script Loaded.');

let processedACSubmissions = new Set();

function initAtCoderObserver() {
  const observer = new MutationObserver(() => {
    checkAtCoderSubmission();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  checkAtCoderSubmission();
}

function checkAtCoderSubmission() {
  // Check for AC label element
  const acSpan = document.querySelector('span.label-success');
  if (!acSpan || acSpan.textContent.trim() !== 'AC') return;

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  let contestId = 'atcoder';
  let problemId = 'problem';

  if (pathParts.includes('contests')) {
    contestId = pathParts[pathParts.indexOf('contests') + 1];
  }
  if (pathParts.includes('tasks')) {
    problemId = pathParts[pathParts.indexOf('tasks') + 1];
  } else {
    problemId = contestId;
  }

  const dedupeKey = `AC_${contestId}_${problemId}_${Math.floor(Date.now() / 60000)}`;
  if (processedACSubmissions.has(dedupeKey)) return;
  processedACSubmissions.add(dedupeKey);

  console.log(`[CP-Sync Content] AC Verdict detected on AtCoder: ${contestId}/${problemId}`);

  // Extract code from submission pre block
  const codePre = document.querySelector('#submission-code') || document.querySelector('pre');
  const code = codePre ? codePre.textContent : '// AtCoder solution source';

  // Extract language from metadata table
  let language = 'cpp';
  const thList = document.querySelectorAll('th');
  thList.forEach((th) => {
    if (th.textContent.includes('Language')) {
      const td = th.nextElementSibling;
      if (td) language = td.textContent.trim().toLowerCase();
    }
  });

  const payload = {
    platform: 'AtCoder',
    problemId,
    problemTitle: `${contestId.toUpperCase()} - ${problemId.toUpperCase()}`,
    code,
    language,
    filePath: `AtCoder/${contestId}/${problemId}.${getExt(language)}`,
  };

  chrome.runtime.sendMessage({ type: 'SYNC_SOLUTION', payload }, (response) => {
    if (response?.success) {
      console.log('[CP-Sync Content] AtCoder solution successfully synced to GitHub.');
    }
  });
}

function getExt(lang) {
  if (lang.includes('c++') || lang.includes('gcc') || lang.includes('clang')) return 'cpp';
  if (lang.includes('java')) return 'java';
  if (lang.includes('python') || lang.includes('pypy')) return 'py';
  if (lang.includes('javascript') || lang.includes('node')) return 'js';
  if (lang.includes('go')) return 'go';
  if (lang.includes('rust')) return 'rs';
  return 'cpp';
}

initAtCoderObserver();
