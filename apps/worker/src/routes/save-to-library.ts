/**
 * Save to library endpoint
 * Moves files from temporary bucket to permanent bucket with AI metadata generation
 */

import type { Env, CorsHeaders } from '../types';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { createAnthropicClient } from '../ai/client';
import { generateImageMetadata, generateDocumentMetadata } from '../utils/file-metadata';

interface SaveToLibraryRequest {
  tempUrl: string; // URL to temp file
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export async function handleSaveToLibrary(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json() as SaveToLibraryRequest;
    const { tempUrl, originalName, mimeType, sizeBytes } = body;

    logger.debug('Processing save to library request', { originalName, mimeType });

    // Extract filename from temp URL
    const tempFilename = tempUrl.split('/').pop();
    if (!tempFilename) {
      throw new WorkerError('Invalid temp URL', 400);
    }

    // Get file from temp bucket
    const tempObject = await env.CHATKIN_TEMP_BUCKET.get(tempFilename);
    if (!tempObject) {
      throw new WorkerError('File not found or expired', 404);
    }

    // Generate new filename for permanent storage
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const ext = `.${originalName.split('.').pop()?.toLowerCase()}`;
    const permFilename = `${timestamp}-${randomStr}${ext}`;

    // Generate AI metadata
    let metadata: { title?: string; description?: string } = {};

    if (mimeType.startsWith('image/')) {
      // Convert to base64 for AI metadata generation
      const arrayBuffer = await tempObject.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000; // 32KB chunks
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binary);

      logger.debug('Generating AI metadata for image', { permFilename });
      const anthropic = createAnthropicClient(env.ANTHROPIC_API_KEY);
      const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      const aiMetadata = await generateImageMetadata(anthropic, base64, mediaType, originalName);
      metadata = {
        title: aiMetadata.title,
        description: aiMetadata.description
      };

      // Copy file to permanent bucket (need to re-read as we consumed the arrayBuffer)
      const tempObject2 = await env.CHATKIN_TEMP_BUCKET.get(tempFilename);
      if (!tempObject2) {
        throw new WorkerError('File not found or expired during copy', 404);
      }

      await env.CHATKIN_BUCKET.put(permFilename, tempObject2.body, {
        httpMetadata: { contentType: mimeType }
      });
    } else {
      // Documents - generate simple metadata
      const docMetadata = generateDocumentMetadata(originalName, mimeType);
      metadata = {
        title: docMetadata.title,
        description: docMetadata.description
      };

      // Copy file to permanent bucket
      await env.CHATKIN_BUCKET.put(permFilename, tempObject.body, {
        httpMetadata: { contentType: mimeType }
      });
    }

    logger.info('File saved to library', {
      tempFilename,
      permFilename,
      hasMetadata: !!(metadata.title || metadata.description)
    });

    return new Response(JSON.stringify({
      success: true,
      file: {
        name: permFilename,
        originalName: originalName,
        size: sizeBytes,
        type: mimeType,
        url: `${env.PUBLIC_WORKER_URL}/api/files/${permFilename}`,
        title: metadata.title,
        description: metadata.description,
        ai_generated_metadata: true
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return handleError(error, 'Save to library failed', corsHeaders);
  }
}
