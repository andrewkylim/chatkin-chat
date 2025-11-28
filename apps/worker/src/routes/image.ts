/**
 * Image transformation endpoint using Cloudflare Image Resizing
 * Format: /cdn-cgi/image/<options>/<filename>
 */

import type { Env, CorsHeaders } from '../types';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { parseImageOptions, buildTransformOptions } from '../utils/image-transform';

export async function handleImageTransform(
  optionsString: string,
  fileName: string,
  env: Env,
  corsHeaders: CorsHeaders
): Promise<Response> {
  try {
    logger.debug('Transforming image', { fileName, options: optionsString });

    // Parse transformation options from URL
    const options = parseImageOptions(optionsString);

    // Get the original file from R2
    const object = await env.CHATKIN_BUCKET.get(fileName);

    if (!object) {
      throw new WorkerError('File not found', 404);
    }

    // Check if file is an image
    const contentType = object.httpMetadata?.contentType || '';
    if (!contentType.startsWith('image/')) {
      throw new WorkerError('File is not an image', 400);
    }

    // Build Cloudflare Image Resizing request
    const transformOptions = buildTransformOptions(options);

    // Create a request to the original file URL
    // We need to fetch from the actual R2 URL to apply transformations
    const fileUrl = `${env.PUBLIC_WORKER_URL}/api/files/${fileName}`;

    // Fetch with image transformation applied
    const response = await fetch(fileUrl, transformOptions);

    // Return transformed image with caching headers
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Vary': 'Accept',
      },
    });
  } catch (error) {
    return handleError(error, 'Image transformation failed', corsHeaders);
  }
}
