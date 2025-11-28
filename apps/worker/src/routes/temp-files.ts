/**
 * Temporary file serving endpoint
 * Serves files from CHATKIN_TEMP_BUCKET (24hr auto-delete)
 */

import type { Env, CorsHeaders } from '../types';
import { logger } from '../utils/logger';

export async function handleTempFileRequest(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const url = new URL(request.url);
  const filename = url.pathname.split('/').pop();

  if (!filename) {
    logger.warn('Temp file request missing filename');
    return new Response('Filename required', {
      status: 400,
      headers: { ...corsHeaders }
    });
  }

  try {
    const object = await env.CHATKIN_TEMP_BUCKET.get(filename);

    if (!object) {
      logger.warn('Temp file not found or expired', { filename });
      return new Response('File not found or expired', {
        status: 404,
        headers: { ...corsHeaders }
      });
    }

    logger.debug('Serving temp file', { filename, size: object.size });

    return new Response(object.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600', // 1 hour cache
        'Content-Length': object.size.toString(),
      },
    });
  } catch (error) {
    logger.error('Error serving temp file', { filename, error });
    return new Response('Error retrieving file', {
      status: 500,
      headers: { ...corsHeaders }
    });
  }
}
