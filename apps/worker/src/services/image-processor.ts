/**
 * Image processing service for R2 file operations
 * Handles image fetching, base64 conversion, and validation
 */

import type { R2Bucket } from '@cloudflare/workers-types';
import { WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export interface ImageData {
  data: string;          // base64 encoded
  mediaType: ImageMediaType;
}

export interface ImageFile {
  url: string;
  name?: string;
  type?: string;
}

/**
 * Fetch image from R2 bucket and convert to base64
 */
export async function fetchImageAsBase64(
  filename: string,
  bucket: R2Bucket
): Promise<ImageData> {
  const object = await bucket.get(filename);

  if (!object) {
    throw new WorkerError('File not found in storage', 404);
  }

  // Convert to base64 using chunking for large files
  const base64 = await arrayBufferToBase64(await object.arrayBuffer());

  // Get media type
  const contentType = object.httpMetadata?.contentType || 'image/jpeg';
  const mediaType = validateImageMediaType(contentType);

  return { data: base64, mediaType };
}

/**
 * Fetch image from URL (R2 path) and convert to base64
 * Automatically determines bucket (permanent vs temporary)
 */
export async function fetchImageFromUrl(
  url: string,
  permanentBucket: R2Bucket,
  tempBucket: R2Bucket
): Promise<ImageData> {
  const filename = extractFilenameFromUrl(url);
  const isTemporary = url.includes('/api/temp-files/');
  const bucket = isTemporary ? tempBucket : permanentBucket;

  return fetchImageAsBase64(filename, bucket);
}

/**
 * Convert ArrayBuffer to base64 using chunking (prevents call stack overflow)
 */
export function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
}

/**
 * Convert File object to base64
 */
export async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
}

/**
 * Validate and normalize image media type
 */
export function validateImageMediaType(contentType: string): ImageMediaType {
  const validTypes: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  if (validTypes.includes(contentType as ImageMediaType)) {
    return contentType as ImageMediaType;
  }

  // Default to JPEG for unknown types
  logger.debug('Unknown image content type, defaulting to JPEG', { contentType });
  return 'image/jpeg';
}

/**
 * Extract filename from file URL
 */
function extractFilenameFromUrl(url: string): string {
  const filename = url.split('/').pop();
  if (!filename) {
    throw new WorkerError('Invalid file URL', 400);
  }
  return filename;
}

/**
 * Batch fetch multiple images from URLs
 */
export async function fetchImagesFromUrls(
  urls: string[],
  permanentBucket: R2Bucket,
  tempBucket: R2Bucket
): Promise<ImageData[]> {
  return Promise.all(
    urls.map(url => fetchImageFromUrl(url, permanentBucket, tempBucket))
  );
}
