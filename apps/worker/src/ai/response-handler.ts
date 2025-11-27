/**
 * AI response parser and handler
 */

import type { Message, TextBlock, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';

export interface AIResponse {
  type: 'message' | 'actions' | 'questions';
  message?: string;
  summary?: string;
  actions?: Array<Record<string, unknown>>;
  questions?: Array<Record<string, unknown>>;
}

export function parseAIResponse(response: Message): AIResponse {
  // Check if AI wants to use a tool
  if (response.stop_reason === 'tool_use') {
    const toolUseBlock = response.content.find((block): block is ToolUseBlock => block.type === 'tool_use');

    if (toolUseBlock) {
      // Get any text response that came before the tool use
      const textBlock = response.content.find((block): block is TextBlock => block.type === 'text');
      const textMessage = textBlock?.text || '';

      if (toolUseBlock.name === 'propose_operations') {
        // AI wants to propose operations
        const input = toolUseBlock.input as Record<string, unknown>;
        return {
          type: 'actions',
          message: textMessage,
          summary: input.summary as string | undefined,
          actions: input.operations as Array<Record<string, unknown>> | undefined
        };
      }

      if (toolUseBlock.name === 'ask_questions') {
        // AI wants to ask questions
        const input = toolUseBlock.input as Record<string, unknown>;
        return {
          type: 'questions',
          message: textMessage,
          questions: input.questions as Array<Record<string, unknown>> | undefined
        };
      }
    }
  }

  // No tool use - return conversational message
  const firstBlock = response.content[0];
  const aiMessage = firstBlock?.type === 'text' ? firstBlock.text : '';
  return {
    type: 'message',
    message: aiMessage
  };
}
