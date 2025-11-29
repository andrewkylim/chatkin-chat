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
    logger.info('Retrieving file from R2', {
      fileName,
      bucket: 'CHATKIN_BUCKET'
    });

    const object = await env.CHATKIN_BUCKET.get(fileName);

    if (!object) {
      logger.warn('File not found in R2', { fileName });
      throw new WorkerError('File not found', 404);
    }

    logger.info('File retrieved successfully', {
      fileName,
      contentType: object.httpMetadata?.contentType,
      size: object.size
    });

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
