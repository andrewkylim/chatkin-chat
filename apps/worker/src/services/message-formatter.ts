/**
 * Message formatting service for Claude API
 * Handles conversation history, image attachments, and API message structure
 */

import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import type { Env } from '../types';
import { fetchImageFromUrl } from './image-processor';
import { logger } from '../utils/logger';

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  files?: Array<{
    url: string;
    name: string;
    type: string;
  }>;
}

export interface FileAttachment {
  url: string;
  name: string;
  type: string;
}

export interface FormatMessagesParams {
  currentMessage: string;
  currentFiles?: FileAttachment[];
  conversationHistory?: ChatMessage[];
  conversationSummary?: string;
}

export class MessageFormatter {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Format conversation history and current message into Anthropic API format
   */
  async formatMessages(params: FormatMessagesParams): Promise<MessageParam[]> {
    const apiMessages: MessageParam[] = [];

    // Add conversation summary if exists
    if (params.conversationSummary) {
      apiMessages.push({
        role: 'user',
        content: `[Previous conversation summary: ${params.conversationSummary}]`
      });
    }

    // Add conversation history
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      for (const msg of params.conversationHistory) {
        // Skip initial AI greeting if first message
        if (apiMessages.length === 0 && msg.role === 'ai') continue;

        const formattedMessage = await this.formatSingleMessage(msg);
        if (formattedMessage) {
          apiMessages.push(formattedMessage);
        }
      }
    }

    // Add current message
    const currentMsg = await this.formatCurrentMessage(
      params.currentMessage,
      params.currentFiles
    );
    apiMessages.push(currentMsg);

    return apiMessages;
  }

  /**
   * Format a single message with optional file attachments
   */
  private async formatSingleMessage(msg: ChatMessage): Promise<MessageParam | null> {
    // Handle messages with images
    if (msg.files && msg.files.length > 0) {
      const imageContents = await this.formatImageAttachments(msg.files);

      // If no images (only non-image files), treat as text-only
      if (imageContents.length === 0) {
        return {
          role: msg.role === 'ai' ? 'assistant' : 'user',
          content: msg.content
        };
      }

      return {
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: [
          { type: 'text' as const, text: msg.content },
          ...imageContents
        ]
      };
    }

    // Text-only message
    return {
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.content
    };
  }

  /**
   * Format current user message
   */
  private async formatCurrentMessage(
    message: string,
    files?: FileAttachment[]
  ): Promise<MessageParam> {
    if (files && files.length > 0) {
      logger.debug('Processing files for current message', {
        fileCount: files.length,
        imageCount: files.filter(f => f.type.startsWith('image/')).length
      });

      const imageContents = await this.formatImageAttachments(files);

      // If we have images, include them in content
      if (imageContents.length > 0) {
        return {
          role: 'user',
          content: [
            { type: 'text' as const, text: message },
            ...imageContents
          ]
        };
      }
    }

    // Text-only message (no files or no image files)
    return {
      role: 'user',
      content: message
    };
  }

  /**
   * Format image files as Anthropic API image content blocks
   */
  private async formatImageAttachments(files: FileAttachment[]) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    return Promise.all(
      imageFiles.map(async (file) => {
        const { data, mediaType } = await fetchImageFromUrl(
          file.url,
          this.env.CHATKIN_BUCKET,
          this.env.CHATKIN_TEMP_BUCKET
        );

        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType,
            data: data
          }
        };
      })
    );
  }
}

/**
 * Factory function
 */
export function createMessageFormatter(env: Env): MessageFormatter {
  return new MessageFormatter(env);
}
