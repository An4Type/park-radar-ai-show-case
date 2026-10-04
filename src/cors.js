const DEFAULT_ALLOWED_ORIGIN = '*';

/**
 * Builds the CORS policy for the public, read-only detection endpoint.
 *
 * With no configuration the endpoint can be consumed by the static showcase
 * during local development. Production deployments can restrict access by
 * setting CORS_ORIGINS to a comma-separated list of exact frontend origins.
 */
export function allowedOriginsFromEnv(value = process.env.CORS_ORIGINS) {
  const origins = (value?.trim() || DEFAULT_ALLOWED_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) return [DEFAULT_ALLOWED_ORIGIN];
  if (origins.includes(DEFAULT_ALLOWED_ORIGIN)) return [DEFAULT_ALLOWED_ORIGIN];
  return origins;
}

export function corsHeaders(origin, allowedOrigins = allowedOriginsFromEnv()) {
  if (!origin) return {};
  if (allowedOrigins.includes(DEFAULT_ALLOWED_ORIGIN)) {
    return { 'Access-Control-Allow-Origin': DEFAULT_ALLOWED_ORIGIN };
  }
  if (!allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  };
}

export function createCorsMiddleware(allowedOrigins = allowedOriginsFromEnv()) {
  return (request, response, next) => {
    response.set({
      ...corsHeaders(request.get('Origin'), allowedOrigins),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    });
    if (request.method === 'OPTIONS') return response.status(204).end();
    return next();
  };
}
