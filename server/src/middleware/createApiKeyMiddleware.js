export function createApiKeyMiddleware(apiKey) {
  return (req, res, next) => {
    if (!apiKey) {
      return next();
    }

    const providedKey = req.headers['x-api-key'] || req.query.api_key;
    if (!providedKey || providedKey !== apiKey) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    return next();
  };
}