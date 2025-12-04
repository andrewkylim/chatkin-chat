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
import { handleGenerateNotes } from './routes/generate-notes';
import { handleSummarizeConversation } from './routes/summarize-conversation';
import { checkTaskReminders } from './cron/task-reminders';
import { analyzePatterns } from './cron/analyze-patterns';
import { processUnprocessedAssessments } from './cron/process-assessments';
import { createNotificationService } from './services/notification-service';
import { createSupabaseAdmin } from './utils/supabase-admin';
import { logger } from './utils/logger';

export { Env };

// Main handler
const handler = {
  async fetch(request: Request, env: Env, _ctx: globalThis.ExecutionContext): Promise<Response> {
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
      return handleGenerateAssessmentReport(request, env, corsHeaders, _ctx);
    }

    if (url.pathname === '/api/generate-onboarding') {
      return handleGenerateOnboarding(request, env, corsHeaders);
    }

    if (url.pathname === '/api/generate-notes') {
      return handleGenerateNotes(request, env, corsHeaders);
    }

    if (url.pathname === '/api/summarize-conversation') {
      return handleSummarizeConversation(request, env, corsHeaders);
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

  async scheduled(controller: globalThis.ScheduledController, env: Env, ctx: globalThis.ExecutionContext): Promise<void> {
    logger.info('Running scheduled jobs...', { cron: controller.cron });

    // Process unprocessed assessments (runs every 5 minutes)
    if (controller.cron === '*/5 * * * *') {
      ctx.waitUntil(
        processUnprocessedAssessments(env).catch((error) => {
          logger.error('Assessment processing failed in scheduled job', { error });
        })
      );
      logger.info('Assessment processing job dispatched');
      return;
    }

    // Daily jobs (runs at 2am UTC)
    if (controller.cron === '0 2 * * *') {
      // Run pattern analysis (detect stuck tasks, domain shutdowns, wins, etc.)
      ctx.waitUntil(
        analyzePatterns(env).catch((error) => {
          logger.error('Pattern analysis failed in scheduled job', { error });
        })
      );

      // Run notification dispatch (task reminders, observations, check-ins)
      const supabase = createSupabaseAdmin(env);
      const notificationService = createNotificationService(supabase);
      ctx.waitUntil(
        notificationService.sendNotifications().catch((error) => {
          logger.error('Notification dispatch failed in scheduled job', { error });
        })
      );

      // Legacy task reminders (can be removed once notification service is fully rolled out)
      ctx.waitUntil(
        checkTaskReminders(env).catch((error) => {
          logger.error('Task reminders failed in scheduled job', { error });
        })
      );

      logger.info('Daily jobs dispatched');
    }
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
