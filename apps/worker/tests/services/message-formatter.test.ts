/**
 * Tests for message-formatter service
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMessageFormatter,
  MessageFormatter,
  type ChatMessage,
  type FormatMessagesParams
} from '../../src/services/message-formatter';
import type { Env } from '../../src/types';
import type { R2Bucket } from '@cloudflare/workers-types';

// Mock the image-processor module
vi.mock('../../src/services/image-processor', () => ({
  fetchImageFromUrl: vi.fn().mockResolvedValue({
    data: 'fake-base64-data',
    mediaType: 'image/png'
  })
}));

describe('MessageFormatter', () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      CHATKIN_BUCKET: {} as R2Bucket,
      CHATKIN_TEMP_BUCKET: {} as R2Bucket,
    } as Env;
  });

  describe('createMessageFormatter', () => {
    it('creates a formatter instance', () => {
      const formatter = createMessageFormatter(mockEnv);
      expect(formatter).toBeInstanceOf(MessageFormatter);
    });
  });

  describe('formatMessages', () => {
    it('formats text-only current message', async () => {
      const formatter = createMessageFormatter(mockEnv);
      const params: FormatMessagesParams = {
        currentMessage: 'Hello, AI!'
      };

      const result = await formatter.formatMessages(params);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: 'user',
        content: 'Hello, AI!'
      });
    });

    it('includes conversation summary when provided', async () => {
      const formatter = createMessageFormatter(mockEnv);
      const params: FormatMessagesParams = {
        currentMessage: 'Continue the conversation',
        conversationSummary: 'We discussed tasks and projects'
      };

      const result = await formatter.formatMessages(params);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        role: 'user',
        content: '[Previous conversation summary: We discussed tasks and projects]'
      });
      expect(result[1]).toEqual({
        role: 'user',
        content: 'Continue the conversation'
      });
    });

    it('formats conversation history correctly', async () => {
      const formatter = createMessageFormatter(mockEnv);
      const history: ChatMessage[] = [
        { role: 'user', content: 'What are my tasks?' },
        { role: 'ai', content: 'You have 3 tasks.' }
      ];

      const params: FormatMessagesParams = {
        currentMessage: 'Show me the first one',
        conversationHistory: history
      };

      const result = await formatter.formatMessages(params);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ role: 'user', content: 'What are my tasks?' });
      expect(result[1]).toEqual({ role: 'assistant', content: 'You have 3 tasks.' });
      expect(result[2]).toEqual({ role: 'user', content: 'Show me the first one' });
    });

    it('skips initial AI greeting in history', async () => {
      const formatter = createMessageFormatter(mockEnv);
      const history: ChatMessage[] = [
        { role: 'ai', content: 'Hello! How can I help?' }, // Should be skipped
        { role: 'user', content: 'What are my tasks?' },
        { role: 'ai', content: 'You have 3 tasks.' }
      ];

      const params: FormatMessagesParams = {
        currentMessage: 'Show me the first one',
        conversationHistory: history
      };

      const result = await formatter.formatMessages(params);

      // Should have 3 messages (skipping initial AI greeting)
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ role: 'user', content: 'What are my tasks?' });
    });

    it('handles messages with image attachments', async () => {
      const formatter = createMessageFormatter(mockEnv);
      const history: ChatMessage[] = [
        {
          role: 'user',
          content: 'Look at this image',
          files: [
            { url: '/api/files/image.png', name: 'image.png', type: 'image/png' }
          ]
        }
      ];

      const params: FormatMessagesParams = {
        currentMessage: 'What do you see?',
        conversationHistory: history
      };

      const result = await formatter.formatMessages(params);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(Array.isArray(result[0].content)).toBe(true);

      const content = result[0].content as any[];
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: 'text', text: 'Look at this image' });
      expect(content[1].type).toBe('image');
    });

    it('handles current message with image attachments', async () => {
      const formatter = createMessageFormatter(mockEnv);
      const params: FormatMessagesParams = {
        currentMessage: 'Analyze this',
        currentFiles: [
          { url: '/api/files/photo.jpg', name: 'photo.jpg', type: 'image/jpeg' }
        ]
      };

      const result = await formatter.formatMessages(params);

      expect(result).toHaveLength(1);
      expect(Array.isArray(result[0].content)).toBe(true);

      const content = result[0].content as any[];
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: 'text', text: 'Analyze this' });
      expect(content[1].type).toBe('image');
    });

    it('filters out non-image files', async () => {
      const formatter = createMessageFormatter(mockEnv);
      const params: FormatMessagesParams = {
        currentMessage: 'Check this file',
        currentFiles: [
          { url: '/api/files/doc.pdf', name: 'doc.pdf', type: 'application/pdf' }
        ]
      };

      const result = await formatter.formatMessages(params);

      // Should be text-only since PDF is not an image
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: 'user',
        content: 'Check this file'
      });
    });

    it('handles mixed image and non-image files', async () => {
      const formatter = createMessageFormatter(mockEnv);
      const params: FormatMessagesParams = {
        currentMessage: 'Multiple files',
        currentFiles: [
          { url: '/api/files/image.png', name: 'image.png', type: 'image/png' },
          { url: '/api/files/doc.pdf', name: 'doc.pdf', type: 'application/pdf' }
        ]
      };

      const result = await formatter.formatMessages(params);

      expect(result).toHaveLength(1);
      expect(Array.isArray(result[0].content)).toBe(true);

      const content = result[0].content as any[];
      // Should have text + 1 image (PDF filtered out)
      expect(content).toHaveLength(2);
      expect(content[1].type).toBe('image');
    });

    it('handles multiple images in current message', async () => {
      const formatter = createMessageFormatter(mockEnv);
      const params: FormatMessagesParams = {
        currentMessage: 'Compare these',
        currentFiles: [
          { url: '/api/files/img1.png', name: 'img1.png', type: 'image/png' },
          { url: '/api/files/img2.jpg', name: 'img2.jpg', type: 'image/jpeg' }
        ]
      };

      const result = await formatter.formatMessages(params);

      expect(result).toHaveLength(1);
      const content = result[0].content as any[];
      // Should have text + 2 images
      expect(content).toHaveLength(3);
      expect(content[0].type).toBe('text');
      expect(content[1].type).toBe('image');
      expect(content[2].type).toBe('image');
    });

    it('handles empty conversation history', async () => {
      const formatter = createMessageFormatter(mockEnv);
      const params: FormatMessagesParams = {
        currentMessage: 'First message',
        conversationHistory: []
      };

      const result = await formatter.formatMessages(params);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: 'user',
        content: 'First message'
      });
    });

    it('handles complex conversation with summary and images', async () => {
      const formatter = createMessageFormatter(mockEnv);
      const history: ChatMessage[] = [
        { role: 'user', content: 'Previous question' },
        { role: 'ai', content: 'Previous answer' },
        {
          role: 'user',
          content: 'Here is an image',
          files: [
            { url: '/api/files/old.png', name: 'old.png', type: 'image/png' }
          ]
        }
      ];

      const params: FormatMessagesParams = {
        currentMessage: 'New question',
        currentFiles: [
          { url: '/api/files/new.jpg', name: 'new.jpg', type: 'image/jpeg' }
        ],
        conversationHistory: history,
        conversationSummary: 'We talked about images'
      };

      const result = await formatter.formatMessages(params);

      // Summary + 3 history messages + current message = 5
      expect(result).toHaveLength(5);
      expect(result[0].content).toContain('We talked about images');
      expect(result[result.length - 1].role).toBe('user');
    });

    it('correctly maps ai role to assistant', async () => {
      const formatter = createMessageFormatter(mockEnv);
      const history: ChatMessage[] = [
        { role: 'ai', content: 'AI response' }
      ];

      const params: FormatMessagesParams = {
        currentMessage: 'User message',
        conversationHistory: history
      };

      const _result = await formatter.formatMessages(params);

      // AI greeting should be skipped, but let's test with non-initial AI message
      const history2: ChatMessage[] = [
        { role: 'user', content: 'User' },
        { role: 'ai', content: 'AI response' }
      ];

      const params2: FormatMessagesParams = {
        currentMessage: 'User message',
        conversationHistory: history2
      };

      const result2 = await formatter.formatMessages(params2);

      expect(result2[1].role).toBe('assistant');
    });
  });
});
