// Per-instance safeguard. Configure shared ingress limits for multiple replicas.
export function rateLimit({ limit = 300, windowMs = 60000, maxClients = 10000, now = Date.now } = {}) {
  const clients = new Map();
  return (req, res, next) => {
    const time = now();
    if (clients.size >= maxClients) for (const [key, value] of clients) if (value.reset <= time) clients.delete(key);
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let client = clients.get(key);
    if (!client || client.reset <= time) {
      if (!client && clients.size >= maxClients) return reject(res, windowMs);
      client = { count: 0, reset: time + windowMs }; clients.set(key, client);
    }
    if (++client.count > limit) return reject(res, client.reset - time);
    next();
  };
}
function reject(res, remaining) {
  res.set('Retry-After', String(Math.max(1, Math.ceil(remaining / 1000))));
  return res.status(429).json({ success: false, error: 'Too many requests. Try again shortly.' });
}
