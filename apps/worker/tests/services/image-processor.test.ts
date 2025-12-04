/**
 * Tests for image-processor service
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchImageAsBase64,
  fetchImageFromUrl,
  arrayBufferToBase64,
  fileToBase64,
  validateImageMediaType,
  fetchImagesFromUrls
} from '../../src/services/image-processor';
import type { R2Bucket } from '@cloudflare/workers-types';

describe('ImageProcessor Service', () => {
  describe('arrayBufferToBase64', () => {
    it('converts small ArrayBuffer to base64', () => {
      const text = 'Hello, World!';
      const encoder = new TextEncoder();
      const arrayBuffer = encoder.encode(text).buffer;

      const result = arrayBufferToBase64(arrayBuffer);
      expect(result).toBe(btoa(text));
    });

    it('handles large ArrayBuffer with chunking', () => {
      // Create a large buffer (100KB) to test chunking
      const size = 100 * 1024;
      const largeBuffer = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        largeBuffer[i] = i % 256;
      }

      const result = arrayBufferToBase64(largeBuffer.buffer);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles empty ArrayBuffer', () => {
      const emptyBuffer = new ArrayBuffer(0);
      const result = arrayBufferToBase64(emptyBuffer);
      expect(result).toBe('');
    });
  });

  describe('validateImageMediaType', () => {
    it('validates image/jpeg', () => {
      expect(validateImageMediaType('image/jpeg')).toBe('image/jpeg');
    });

    it('validates image/png', () => {
      expect(validateImageMediaType('image/png')).toBe('image/png');
    });

    it('validates image/gif', () => {
      expect(validateImageMediaType('image/gif')).toBe('image/gif');
    });

    it('validates image/webp', () => {
      expect(validateImageMediaType('image/webp')).toBe('image/webp');
    });

    it('defaults to image/jpeg for unknown types', () => {
      expect(validateImageMediaType('image/unknown')).toBe('image/jpeg');
      expect(validateImageMediaType('application/pdf')).toBe('image/jpeg');
      expect(validateImageMediaType('')).toBe('image/jpeg');
    });
  });

  describe('fetchImageAsBase64', () => {
    let mockBucket: R2Bucket;

    beforeEach(() => {
      mockBucket = {
        get: vi.fn(),
      } as unknown as R2Bucket;
    });

    it('fetches image from R2 and converts to base64', async () => {
      const imageData = new TextEncoder().encode('fake-image-data');
      const mockObject = {
        arrayBuffer: vi.fn().mockResolvedValue(imageData.buffer),
        httpMetadata: { contentType: 'image/png' }
      };

      (mockBucket.get as any).mockResolvedValue(mockObject);

      const result = await fetchImageAsBase64('test.png', mockBucket);

      expect(mockBucket.get).toHaveBeenCalledWith('test.png');
      expect(result.mediaType).toBe('image/png');
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('throws error when file not found', async () => {
      (mockBucket.get as any).mockResolvedValue(null);

      await expect(
        fetchImageAsBase64('nonexistent.jpg', mockBucket)
      ).rejects.toThrow('File not found in storage');
    });

    it('defaults to image/jpeg when contentType is missing', async () => {
      const imageData = new TextEncoder().encode('fake-image-data');
      const mockObject = {
        arrayBuffer: vi.fn().mockResolvedValue(imageData.buffer),
        httpMetadata: {}
      };

      (mockBucket.get as any).mockResolvedValue(mockObject);

      const result = await fetchImageAsBase64('test.jpg', mockBucket);

      expect(result.mediaType).toBe('image/jpeg');
    });

    it('validates media type correctly', async () => {
      const imageData = new TextEncoder().encode('fake-image-data');
      const mockObject = {
        arrayBuffer: vi.fn().mockResolvedValue(imageData.buffer),
        httpMetadata: { contentType: 'image/webp' }
      };

      (mockBucket.get as any).mockResolvedValue(mockObject);

      const result = await fetchImageAsBase64('test.webp', mockBucket);

      expect(result.mediaType).toBe('image/webp');
    });
  });

  describe('fetchImageFromUrl', () => {
    let mockPermanentBucket: R2Bucket;
    let mockTempBucket: R2Bucket;

    beforeEach(() => {
      mockPermanentBucket = {
        get: vi.fn(),
      } as unknown as R2Bucket;

      mockTempBucket = {
        get: vi.fn(),
      } as unknown as R2Bucket;
    });

    it('uses temporary bucket for temp-files URLs', async () => {
      const imageData = new TextEncoder().encode('fake-image-data');
      const mockObject = {
        arrayBuffer: vi.fn().mockResolvedValue(imageData.buffer),
        httpMetadata: { contentType: 'image/png' }
      };

      (mockTempBucket.get as any).mockResolvedValue(mockObject);

      const result = await fetchImageFromUrl(
        '/api/temp-files/temp-123.png',
        mockPermanentBucket,
        mockTempBucket
      );

      expect(mockTempBucket.get).toHaveBeenCalledWith('temp-123.png');
      expect(mockPermanentBucket.get).not.toHaveBeenCalled();
      expect(result.mediaType).toBe('image/png');
    });

    it('uses permanent bucket for regular file URLs', async () => {
      const imageData = new TextEncoder().encode('fake-image-data');
      const mockObject = {
        arrayBuffer: vi.fn().mockResolvedValue(imageData.buffer),
        httpMetadata: { contentType: 'image/jpeg' }
      };

      (mockPermanentBucket.get as any).mockResolvedValue(mockObject);

      const result = await fetchImageFromUrl(
        '/api/files/photo-456.jpg',
        mockPermanentBucket,
        mockTempBucket
      );

      expect(mockPermanentBucket.get).toHaveBeenCalledWith('photo-456.jpg');
      expect(mockTempBucket.get).not.toHaveBeenCalled();
      expect(result.mediaType).toBe('image/jpeg');
    });

    it('extracts filename correctly from various URL formats', async () => {
      const imageData = new TextEncoder().encode('fake-image-data');
      const mockObject = {
        arrayBuffer: vi.fn().mockResolvedValue(imageData.buffer),
        httpMetadata: { contentType: 'image/png' }
      };

      (mockPermanentBucket.get as any).mockResolvedValue(mockObject);

      await fetchImageFromUrl(
        'https://example.com/api/files/image.png',
        mockPermanentBucket,
        mockTempBucket
      );

      expect(mockPermanentBucket.get).toHaveBeenCalledWith('image.png');
    });

    it('throws error for invalid URL', async () => {
      await expect(
        fetchImageFromUrl('/', mockPermanentBucket, mockTempBucket)
      ).rejects.toThrow('Invalid file URL');
    });
  });

  describe('fileToBase64', () => {
    it('converts File object to base64', async () => {
      const text = 'File content';
      const blob = new Blob([text], { type: 'image/png' });
      const file = new File([blob], 'test.png', { type: 'image/png' });

      const result = await fileToBase64(file);

      expect(result).toBe(btoa(text));
    });

    it('handles large files with chunking', async () => {
      // Create a large file (100KB)
      const size = 100 * 1024;
      const largeBuffer = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        largeBuffer[i] = i % 256;
      }

      const blob = new Blob([largeBuffer], { type: 'image/jpeg' });
      const file = new File([blob], 'large.jpg', { type: 'image/jpeg' });

      const result = await fileToBase64(file);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('fetchImagesFromUrls', () => {
    let mockPermanentBucket: R2Bucket;
    let mockTempBucket: R2Bucket;

    beforeEach(() => {
      mockPermanentBucket = {
        get: vi.fn(),
      } as unknown as R2Bucket;

      mockTempBucket = {
        get: vi.fn(),
      } as unknown as R2Bucket;
    });

    it('fetches multiple images in parallel', async () => {
      const imageData = new TextEncoder().encode('fake-image-data');
      const mockObject = {
        arrayBuffer: vi.fn().mockResolvedValue(imageData.buffer),
        httpMetadata: { contentType: 'image/png' }
      };

      (mockPermanentBucket.get as any).mockResolvedValue(mockObject);

      const urls = [
        '/api/files/image1.png',
        '/api/files/image2.png',
        '/api/files/image3.png'
      ];

      const results = await fetchImagesFromUrls(urls, mockPermanentBucket, mockTempBucket);

      expect(results).toHaveLength(3);
      expect(mockPermanentBucket.get).toHaveBeenCalledTimes(3);
      results.forEach(result => {
        expect(result.mediaType).toBe('image/png');
        expect(result.data).toBeDefined();
      });
    });

    it('handles mixed bucket types', async () => {
      const imageData = new TextEncoder().encode('fake-image-data');
      const mockObject = {
        arrayBuffer: vi.fn().mockResolvedValue(imageData.buffer),
        httpMetadata: { contentType: 'image/png' }
      };

      (mockPermanentBucket.get as any).mockResolvedValue(mockObject);
      (mockTempBucket.get as any).mockResolvedValue(mockObject);

      const urls = [
        '/api/files/permanent.png',
        '/api/temp-files/temporary.png'
      ];

      const results = await fetchImagesFromUrls(urls, mockPermanentBucket, mockTempBucket);

      expect(results).toHaveLength(2);
      expect(mockPermanentBucket.get).toHaveBeenCalledWith('permanent.png');
      expect(mockTempBucket.get).toHaveBeenCalledWith('temporary.png');
    });

    it('handles empty array', async () => {
      const results = await fetchImagesFromUrls([], mockPermanentBucket, mockTempBucket);

      expect(results).toHaveLength(0);
      expect(mockPermanentBucket.get).not.toHaveBeenCalled();
      expect(mockTempBucket.get).not.toHaveBeenCalled();
    });
  });
});
