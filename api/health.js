// Blue Atlas production backend health endpoint. No secrets or user data returned.
export function GET() {
  return Response.json({
    service: 'blue-atlas',
    status: 'ok',
    runtime: 'vercel-functions',
    version: 1,
    capabilities: {
      earthquakes: '/api/earthquakes',
      existingLocalMiddleware: 'not-deployed',
    },
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
