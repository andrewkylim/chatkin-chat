/**
 * File upload endpoint handler
 */

import type { Env, CorsHeaders } from '../types';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { moderateImageContent } from '../utils/moderation';
import { generateImageMetadata, generateDocumentMetadata } from '../utils/file-metadata';
import { createAnthropicClient } from '../ai/client';
import { requireAuth } from '../middleware/auth';
import { fileToBase64, validateImageMediaType } from '../services/image-processor';

// File upload constraints
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  // Images
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  // Documents
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
};

export async function handleUpload(
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
    // Require authentication
    const user = await requireAuth(request, env);
    logger.debug('Authenticated file upload request', { userId: user.userId });

    const formData = await request.formData();
    const fileEntry = formData.get('file');
    const permanent = formData.get('permanent') === 'true'; // If true, save to permanent bucket with DB entry

    if (!fileEntry || typeof fileEntry === 'string') {
      throw new WorkerError('No file provided', 400);
    }

    const file = fileEntry as File;

    logger.debug('Processing file upload', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new WorkerError(
        `File size exceeds maximum allowed size of 10MB (received: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        413
      );
    }

    // Validate MIME type
    const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
    const allowedExtensions = ALLOWED_MIME_TYPES[file.type];

    if (!allowedExtensions) {
      throw new WorkerError(`File type '${file.type}' is not allowed`, 415);
    }

    if (!allowedExtensions.includes(fileExt)) {
      throw new WorkerError(
        `File extension '${fileExt}' does not match MIME type '${file.type}'`,
        415
      );
    }

    // Content moderation for images
    if (file.type.startsWith('image/')) {
      logger.debug('Moderating image content', { fileName: file.name });

      // Convert to base64 using image processor service
      const base64 = await fileToBase64(file);

      // Moderate content
      const anthropic = createAnthropicClient(env.ANTHROPIC_API_KEY);
      const mediaType = validateImageMediaType(file.type);
      const moderation = await moderateImageContent(anthropic, base64, mediaType);

      // Get arrayBuffer for file recreation after moderation
      const arrayBuffer = await file.arrayBuffer();

      if (!moderation.safe || moderation.riskLevel >= 2) {
        logger.warn('Image rejected by moderation', {
          fileName: file.name,
          riskLevel: moderation.riskLevel,
          categories: moderation.categories
        });

        throw new WorkerError(
          'Image contains inappropriate content and cannot be uploaded',
          403
        );
      }

      // Need to recreate the file from arrayBuffer since we consumed it
      const moderatedFile = new File([arrayBuffer], file.name, { type: file.type });

      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const fileName = `${timestamp}-${randomStr}${fileExt}`;

      // Generate AI metadata if saving to permanent library
      let metadata: { title?: string; description?: string } = {};
      if (permanent) {
        logger.debug('Generating AI metadata for permanent file', { fileName: file.name });
        const aiMetadata = await generateImageMetadata(anthropic, base64, mediaType, file.name);
        metadata = {
          title: aiMetadata.title,
          description: aiMetadata.description
        };
      }

      // Choose bucket based on permanent flag
      const bucket = permanent ? env.CHATKIN_BUCKET : env.CHATKIN_TEMP_BUCKET;

      // Upload to R2
      await bucket.put(fileName, moderatedFile.stream() as ReadableStream, {
        httpMetadata: {
          contentType: file.type,
        },
      });

      logger.info('File uploaded successfully', { fileName, permanent, bucket: permanent ? 'permanent' : 'temporary' });

      // Return file metadata
      return new Response(JSON.stringify({
        success: true,
        file: {
          name: fileName,
          originalName: file.name,
          size: file.size,
          type: file.type,
          url: permanent
            ? `${env.PUBLIC_WORKER_URL}/api/files/${fileName}`
            : `${env.PUBLIC_WORKER_URL}/api/temp-files/${fileName}`,
          temporary: !permanent,
          title: metadata.title,
          description: metadata.description,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Non-image files (documents) - skip moderation
    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const fileName = `${timestamp}-${randomStr}${fileExt}`;

    // Generate metadata if saving to permanent library
    let metadata: { title?: string; description?: string } = {};
    if (permanent) {
      const docMetadata = generateDocumentMetadata(file.name, file.type);
      metadata = {
        title: docMetadata.title,
        description: docMetadata.description
      };
    }

    // Choose bucket based on permanent flag
    const bucket = permanent ? env.CHATKIN_BUCKET : env.CHATKIN_TEMP_BUCKET;

    // Upload to R2
    await bucket.put(fileName, file.stream() as ReadableStream, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    logger.info('File uploaded successfully', { fileName, permanent, bucket: permanent ? 'permanent' : 'temporary' });

    // Return file metadata
    return new Response(JSON.stringify({
      success: true,
      file: {
        name: fileName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        url: permanent
          ? `${env.PUBLIC_WORKER_URL}/api/files/${fileName}`
          : `${env.PUBLIC_WORKER_URL}/api/temp-files/${fileName}`,
        temporary: !permanent,
        title: metadata.title,
        description: metadata.description,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return handleError(error, 'File upload failed', corsHeaders);
  }
}
