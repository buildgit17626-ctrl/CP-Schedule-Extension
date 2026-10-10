let key = '', cursor = null, busy = false, session = 0;
const $ = id => document.getElementById(id);
const node = (tag, text) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; return element; };
async function api(path, method = 'GET') {
  const activeSession = session;
  const response = await fetch('/api/v1/admin/profiles' + path, { method, headers: { Authorization: 'Bearer ' + key }, cache: 'no-store', signal: AbortSignal.timeout(60000) });
  const result = await response.json();
  if (activeSession !== session) throw new Error('Admin session ended.');
  if (!response.ok || !result.success) {
    if (response.status === 401) signOut();
    throw new Error(result.error || 'Request failed');
  }
  return result.data;
}
function render(records) {
  $('profiles').replaceChildren();
  if (!records.length) { $('profiles').append(node('p', 'No profiles have been shared on this page.')); return; }
  for (const record of records) {
    const article = node('article'), title = node('h2', 'Shared profile · ' + record._id.slice(0, 10));
    article.append(title, node('p', 'Consent: ' + new Date(record.consentAt).toLocaleString()));
    const wrap = node('div'); wrap.className = 'table-wrap'; const table = node('table'), head = node('tr');
    for (const text of ['Platform', 'Handle', 'Rating', 'Highest', 'Solved', 'Last checked']) head.append(node('th', text));
    const thead = node('thead'); thead.append(head); table.append(thead); const body = node('tbody');
    for (const [platform, handle] of Object.entries(record.handles)) {
      const data = record.snapshots?.[platform], row = node('tr'); row.append(node('td', platform));
      const cell = node('td'), anchor = node('a', handle);
      const origins = { Codeforces: 'https://codeforces.com/profile/', LeetCode: 'https://leetcode.com/u/', AtCoder: 'https://atcoder.jp/users/', CodeChef: 'https://www.codechef.com/users/', CSES: 'https://cses.fi/user/' };
      anchor.href = origins[platform] + encodeURIComponent(handle) + '/'; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; cell.append(anchor); row.append(cell);
      row.append(node('td', data?.rating == null ? '—' : Math.round(data.rating)), node('td', data?.maxRating ?? '—'), node('td', data?.solved == null ? '—' : (data.solvedPartial ? '≥ ' : '') + data.solved), node('td', data ? (data.status === 'unavailable' ? 'Unavailable · ' : '') + new Date(data.checkedAt).toLocaleString() : 'Not refreshed'));
      body.append(row);
    }
    table.append(body); wrap.append(table); article.append(wrap);
    const button = node('button', 'Refresh public statistics'); button.addEventListener('click', async () => {
      const activeSession = session;
      button.disabled = true; $('status').textContent = 'Fetching public statistics…';
      try {
        const updated = await api('/' + record._id + '/refresh', 'POST');
        Object.assign(record, updated || {}); render(records); $('status').textContent = updated ? 'Statistics updated or served from the daily cache.' : 'Profile was withdrawn.';
      } catch (error) { if (session === activeSession) $('status').textContent = error.message; } finally { button.disabled = false; }
    }); article.append(button); $('profiles').append(article);
  }
}
async function load(next = false) {
  if (busy) return; busy = true; $('status').textContent = 'Loading…'; $('next').disabled = true;
  const activeSession = session;
  try {
    const data = await api(next && cursor ? '?cursor=' + encodeURIComponent(cursor) : '');
    cursor = data.cursor; render(data.items); $('login').hidden = true; $('dashboard').hidden = false; $('status').textContent = '';
  } catch (error) { if (session === activeSession) $('status').textContent = error.message; }
  finally { if (session === activeSession) { busy = false; $('next').disabled = !cursor; } }
}
function signOut() { session++; busy = false; key = ''; cursor = null; $('profiles').replaceChildren(); $('dashboard').hidden = true; $('login').hidden = false; $('key').value = ''; $('status').textContent = ''; }
$('login').addEventListener('submit', event => { event.preventDefault(); key = $('key').value; $('key').value = ''; load(); });
$('logout').addEventListener('click', signOut); $('reload').addEventListener('click', () => load()); $('next').addEventListener('click', () => load(true));
