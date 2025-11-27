/**
 * File retrieval endpoint handler
 */

import type { Env, CorsHeaders } from '../types';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';

export async function handleFileRetrieval(
  fileName: string,
  env: Env,
  corsHeaders: CorsHeaders
): Promise<Response> {
  try {
    logger.debug('Retrieving file', { fileName });

    const object = await env.CHATKIN_BUCKET.get(fileName);

    if (!object) {
      throw new WorkerError('File not found', 404);
    }

    return new Response(object.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    return handleError(error, 'File retrieval failed', corsHeaders);
  }
}
