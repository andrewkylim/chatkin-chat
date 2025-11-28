/**
 * File deletion endpoint handler
 * Deletes files from R2 storage
 */

import type { Env, CorsHeaders } from '../types';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth';

export async function handleDeleteFile(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders
): Promise<Response> {
  if (request.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Require authentication
    const user = await requireAuth(request, env);
    logger.debug('Authenticated file deletion request', { userId: user.userId });

    const body = await request.json() as { r2_key?: string };
    const { r2_key } = body;

    if (!r2_key) {
      throw new WorkerError('r2_key is required', 400);
    }

    logger.debug('Deleting file from R2', { r2_key });

    // Delete from permanent bucket
    await env.CHATKIN_BUCKET.delete(r2_key);

    logger.info('File deleted from R2', { r2_key });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return handleError(error, 'File deletion failed', corsHeaders);
  }
}
