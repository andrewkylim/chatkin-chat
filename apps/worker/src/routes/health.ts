/**
 * Health check endpoint
 */

import type { CorsHeaders } from '../types';

export function handleHealth(corsHeaders: CorsHeaders): Response {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
