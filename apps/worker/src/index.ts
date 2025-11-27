/**
 * Chatkin OS Worker
 * Handles AI API calls, file uploads, and other serverless functions
 */

import { withSentry } from '@sentry/cloudflare';
import type { Env } from './types';
import { getCorsHeaders, handlePreflight } from './middleware/cors';
import { handleHealth } from './routes/health';
import { handleAIChat } from './routes/ai-chat';
import { handleUpload } from './routes/upload';
import { handleFileRetrieval } from './routes/files';

export { Env };

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Get CORS headers
    const corsHeaders = getCorsHeaders(request, env);

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return handlePreflight(corsHeaders);
    }

    // Route handling
    if (url.pathname === '/api/health') {
      return handleHealth(corsHeaders);
    }

    if (url.pathname === '/api/ai/chat') {
      return handleAIChat(request, env, corsHeaders);
    }

    if (url.pathname === '/api/upload') {
      return handleUpload(request, env, corsHeaders);
    }

    if (url.pathname.startsWith('/api/files/')) {
      const fileName = url.pathname.replace('/api/files/', '');
      return handleFileRetrieval(fileName, env, corsHeaders);
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};

// Wrap handler with Sentry for error tracking and performance monitoring
export default withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.1, // Sample 10% of transactions
  }),
  handler
);
