/**
 * Builds the CORS policy for the public, read-only detection endpoint.
 *
 * Camera detections contain no user-specific data or credentials, so browser
 * clients must be able to read the feed from local development origins as
 * well as the deployed showcase.
 */
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export function createCorsMiddleware() {
  return (request, response, next) => {
    response.set(corsHeaders());
    if (request.method === 'OPTIONS') return response.status(204).end();
    return next();
  };
}
