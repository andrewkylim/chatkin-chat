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
    logger.info('Image transform request received', {
      fileName,
      options: optionsString,
      fullPath: `${optionsString}/${fileName}`
    });

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

    // Return the R2 object directly with CF image transformation options
    // Cloudflare will apply the transformations at the edge
    return new Response(object.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Vary': 'Accept',
      },
      // @ts-ignore - CF-specific property
      cf: transformOptions.cf
    });
  } catch (error) {
    return handleError(error, 'Image transformation failed', corsHeaders);
  }
}
