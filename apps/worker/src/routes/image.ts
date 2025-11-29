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

    // Build Cloudflare Image Resizing fetch options
    const cfOptions = buildTransformOptions(options);

    // Construct the URL to the original file
    // Image Resizing works by fetching the original image with cf options
    const imageUrl = `${env.PUBLIC_WORKER_URL}/api/files/${fileName}`;

    logger.info('Fetching image with transformation options', {
      imageUrl,
      cfOptions: JSON.stringify(cfOptions)
    });

    // Fetch the image with Cloudflare Image Resizing options
    // This is the correct way to use Image Resizing - pass cf options to fetch()
    // @ts-expect-error - Cloudflare Workers extend fetch with cf property
    const response = await fetch(imageUrl, cfOptions);

    if (!response.ok) {
      logger.error('Failed to fetch/transform image', {
        status: response.status,
        statusText: response.statusText,
        imageUrl
      });
      throw new WorkerError(`Failed to fetch image: ${response.statusText}`, response.status);
    }

    // Get the content type from the transformed response
    // Cloudflare will set this to the output format (e.g., image/webp)
    const contentType = response.headers.get('Content-Type') || 'image/jpeg';

    logger.info('Image transformation successful', {
      fileName,
      outputContentType: contentType,
      originalOptions: optionsString
    });

    // Return the transformed image with proper caching headers
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Vary': 'Accept',
      },
    });
  } catch (error) {
    return handleError(error, 'Image transformation failed', corsHeaders);
  }
}
