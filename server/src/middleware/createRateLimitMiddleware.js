const rateStore = new Map();

export function createRateLimitMiddleware({ apiKeyEnabled, rateLimit, rateWindowMs }) {
  return (req, res, next) => {
    const key = apiKeyEnabled ? (req.headers['x-api-key'] || req.ip) : req.ip;
    const now = Date.now();
    const entry = rateStore.get(key) || { count: 0, start: now };

    if (now - entry.start > rateWindowMs) {
      entry.count = 0;
      entry.start = now;
    }

    entry.count += 1;
    rateStore.set(key, entry);

    if (entry.count > rateLimit) {
      res.set('Retry-After', Math.ceil((entry.start + rateWindowMs - now) / 1000));
      return res.status(429).json({ error: 'Too many requests, slow down' });
    }

    return next();
  };
}