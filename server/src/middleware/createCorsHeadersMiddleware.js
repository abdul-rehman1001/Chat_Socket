export function createCorsHeadersMiddleware(clientOrigin) {
  return (req, res, next) => {
    res.header('Access-Control-Allow-Origin', clientOrigin);
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
  };
}