/**
 * File metadata generation using Claude API
 * Generates titles and descriptions for files saved to library
 */

import type { Anthropic } from '@anthropic-ai/sdk';
import { logger } from './logger';

export interface FileMetadata {
  title: string;
  description: string;
}

/**
 * Generate title and description for an image using Claude API
 * Uses Claude Haiku for cost-effectiveness (~$0.00003 per image)
 * Only called for files saved to library (not hidden files)
 */
export async function generateImageMetadata(
  anthropic: Anthropic,
  imageData: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  originalFilename: string
): Promise<FileMetadata> {
  const prompt = `You are an AI assistant that generates helpful metadata for image files in a personal productivity app.

Analyze the provided image and generate:
1. A short, descriptive title (2-8 words)
2. A brief description of the image content (1-2 sentences)

The title should be clear and searchable. The description should help the user understand what's in the image at a glance.

Original filename: ${originalFilename}

Respond with ONLY a JSON object in this exact format:
{
  "title": "Short descriptive title",
  "description": "Brief description of the image content"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 150,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageData
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    });

    // Extract JSON from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from metadata generation API');
    }

    const result = JSON.parse(textContent.text) as FileMetadata;

    logger.info('Image metadata generated', {
      title: result.title,
      filename: originalFilename
    });

    return result;
  } catch (error) {
    logger.error('Image metadata generation failed', error);
    // Fallback to filename-based metadata
    const fallbackTitle = originalFilename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    return {
      title: fallbackTitle,
      description: 'Image file'
    };
  }
}

/**
 * Generate metadata for document files (PDF, TXT, DOC, DOCX)
 * Uses filename as basis since we can't analyze document content easily
 */
export function generateDocumentMetadata(
  originalFilename: string,
  mimeType: string
): FileMetadata {
  // Extract filename without extension and clean it up
  const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
  const cleanName = nameWithoutExt.replace(/[-_]/g, ' ');

  // Determine file type description
  const typeMap: Record<string, string> = {
    'application/pdf': 'PDF document',
    'text/plain': 'Text file',
    'application/msword': 'Word document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document'
  };

  const fileType = typeMap[mimeType] || 'Document';

  return {
    title: cleanName || 'Untitled document',
    description: fileType
  };
}
