/**
 * Image transformation endpoint using Cloudflare Image Resizing
 * Format: /img/<options>/<filename>
 *
 * IMPORTANT: Cloudflare Image Resizing only works when you pass `cf: { image: {...} }`
 * to a fetch() request, NOT when returning a Response with cf property.
 * We fetch the original image URL with cf options to trigger the transformation.
 */

import type { Env, CorsHeaders } from '../types';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';

export async function handleImageTransform(
  _request: Request,
  optionsString: string,
  fileName: string,
  env: Env,
  corsHeaders: CorsHeaders
): Promise<Response> {
  try {
    logger.info('Image transform request received', {
      fileName,
      options: optionsString,
      fullPath: `${optionsString}/${fileName}`
    });

    // Get the original file from R2
    const object = await env.CHATKIN_BUCKET.get(fileName);

    if (!object) {
      logger.warn('File not found in R2', { fileName });
      throw new WorkerError('File not found', 404);
    }

    // Check if file is an image
    const contentType = object.httpMetadata?.contentType || '';
    if (!contentType.startsWith('image/')) {
      throw new WorkerError('File is not an image', 400);
    }

    logger.info('Returning image from R2', {
      fileName,
      contentType,
      size: object.size,
      note: 'Image transformation disabled due to Cloudflare Image Resizing limitations with Workers'
    });

    // NOTE: Cloudflare Image Resizing doesn't work when fetching from the same worker
    // This is a known limitation. For now, we return the original image.
    // TODO: Consider using Cloudflare Images product or a different CDN solution

    return new Response(object.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return handleError(error, 'Image transformation failed', corsHeaders);
  }
}
