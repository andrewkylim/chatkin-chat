/**
 * CORS middleware for Cloudflare Workers
 */

import type { Env, CorsHeaders } from '../types';

export function getCorsHeaders(request: Request, env: Env): CorsHeaders {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [
        'http://localhost:5173',
        'http://localhost:4173',
        'https://chatkin.ai',
        'https://www.chatkin.ai'
      ];

  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function handlePreflight(corsHeaders: CorsHeaders): Response {
  // Preflight requests are handled by returning early with CORS headers
  return new Response(null, {
    headers: corsHeaders as unknown as HeadersInit
  });
}
