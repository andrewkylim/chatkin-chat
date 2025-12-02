/**
 * Chatkin OS Worker
 * Handles AI API calls, file uploads, and other serverless functions
 */

import * as Sentry from '@sentry/cloudflare';
import type { Env } from './types';
import { getCorsHeaders, handlePreflight } from './middleware/cors';
import { handleHealth } from './routes/health';
import { handleAIChat } from './routes/ai-chat';
import { handleUpload } from './routes/upload';
import { handleFileRetrieval } from './routes/files';
import { handleImageTransform } from './routes/image';
import { handleTempFileRequest } from './routes/temp-files';
import { handleSaveToLibrary } from './routes/save-to-library';
import { handleDeleteFile } from './routes/delete-file';
import { handleSendNotification } from './routes/send-notification';
import { handleGenerateAssessmentReport } from './routes/generate-assessment-report';
import { handleGenerateOnboarding } from './routes/generate-onboarding';
import { checkTaskReminders } from './cron/task-reminders';

export { Env };

// Main handler
const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

    if (url.pathname === '/api/save-to-library') {
      return handleSaveToLibrary(request, env, corsHeaders);
    }

    if (url.pathname === '/api/delete-file') {
      return handleDeleteFile(request, env, corsHeaders);
    }

    if (url.pathname === '/api/send-notification') {
      return handleSendNotification(request, env, corsHeaders);
    }

    if (url.pathname === '/api/generate-assessment-report') {
      return handleGenerateAssessmentReport(request, env, corsHeaders, ctx);
    }

    if (url.pathname === '/api/generate-onboarding') {
      return handleGenerateOnboarding(request, env, corsHeaders);
    }

    if (url.pathname.startsWith('/api/temp-files/')) {
      return handleTempFileRequest(request, env, corsHeaders);
    }

    // Handle CDN image transformations: /img/<options>/<filename>
    if (url.pathname.startsWith('/img/')) {
      const pathParts = url.pathname.replace('/img/', '').split('/');
      if (pathParts.length >= 2) {
        const optionsString = pathParts[0];
        const fileName = pathParts.slice(1).join('/');
        return handleImageTransform(request, optionsString, fileName, env, corsHeaders);
      }
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

  async scheduled(_controller: globalThis.ScheduledController, env: Env, ctx: globalThis.ExecutionContext): Promise<void> {
    // Run task reminder checks
    ctx.waitUntil(checkTaskReminders(env));
  },
};

// Wrap with Sentry for error tracking
export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.1,
  }),
  handler
);
