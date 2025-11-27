/**
 * AI response parser and handler
 */

import type { Message } from '@anthropic-ai/sdk/resources/messages';

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
    const toolUseBlock = response.content.find((block: Record<string, unknown>) => block.type === 'tool_use');

    if (toolUseBlock) {
      // Get any text response that came before the tool use
      const textBlock = response.content.find((block: Record<string, unknown>) => block.type === 'text');
      const textMessage = textBlock && textBlock.type === 'text' ? textBlock.text : '';

      if (toolUseBlock.type === 'tool_use' && toolUseBlock.name === 'propose_operations') {
        // AI wants to propose operations
        const input = toolUseBlock.input as Record<string, unknown>;
        return {
          type: 'actions',
          message: textMessage,
          summary: input.summary,
          actions: input.operations
        };
      }

      if (toolUseBlock.type === 'tool_use' && toolUseBlock.name === 'ask_questions') {
        // AI wants to ask questions
        const input = toolUseBlock.input as Record<string, unknown>;
        return {
          type: 'questions',
          message: textMessage,
          questions: input.questions
        };
      }
    }
  }

  // No tool use - return conversational message
  const aiMessage = response.content[0].type === 'text' ? response.content[0].text : '';
  return {
    type: 'message',
    message: aiMessage
  };
}
