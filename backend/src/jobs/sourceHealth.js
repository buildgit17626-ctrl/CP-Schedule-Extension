const names = ['Codeforces', 'LeetCode', 'AtCoder', 'CodeChef', 'Aggregate feeds', 'Unstop'];
const health = new Map();
export function recordSourceResults(results, now = Date.now()) {
  results.forEach((result, index) => {
    const name = names[index];
    if (!name) return;
    const previous = health.get(name);
    const count = result.status === 'fulfilled' && Array.isArray(result.value) ? result.value.length : 0;
    const status = result.status === 'rejected' ? 'unavailable' : count ? 'available' : 'empty';
    health.set(name, { name, status, count, checkedAt: now,
      lastDataAt: count ? now : previous?.lastDataAt || null,
      message: status === 'unavailable' ? 'Source request failed; saved contests are retained.' : status === 'empty' ? 'No contests returned. This can mean no upcoming events or unavailable coverage.' : null });
  });
}
export function getSourceHealth() {
  const items = names.map(name => health.get(name) || { name, status: 'not_checked', count: 0, checkedAt: null, lastDataAt: null });
  return { items, aggregateConfigured: Boolean(process.env.CLIST_USERNAME && process.env.CLIST_API_KEY) };
}
