import { describe, it, expect } from 'vitest';
import { parseAIResponse } from '../../src/ai/response-handler';
import type { Message } from '@anthropic-ai/sdk/resources/messages';

describe('AI Response Handler', () => {
  describe('parseAIResponse - Simple Messages', () => {
    it('should parse simple text response', () => {
      const mockResponse: Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Hello! How can I help you today?'
          }
        ],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      const result = parseAIResponse(mockResponse);

      expect(result.type).toBe('message');
      expect(result.message).toBe('Hello! How can I help you today?');
      expect(result.actions).toBeUndefined();
      expect(result.questions).toBeUndefined();
    });

    it('should handle empty text content', () => {
      const mockResponse: Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: ''
          }
        ],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      const result = parseAIResponse(mockResponse);

      expect(result.type).toBe('message');
      expect(result.message).toBe('');
    });
  });

  describe('parseAIResponse - Tool Use: propose_operations', () => {
    it('should parse propose_operations tool use', () => {
      const mockResponse: Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I can create those tasks for you.'
          },
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'propose_operations',
            input: {
              summary: 'Creating 2 tasks',
              operations: [
                {
                  operation: 'create',
                  type: 'task',
                  data: { title: 'Task 1', status: 'todo' }
                },
                {
                  operation: 'create',
                  type: 'task',
                  data: { title: 'Task 2', status: 'todo' }
                }
              ]
            }
          }
        ],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 30 }
      };

      const result = parseAIResponse(mockResponse);

      expect(result.type).toBe('actions');
      expect(result.message).toBe('I can create those tasks for you.');
      expect(result.summary).toBe('Creating 2 tasks');
      expect(result.actions).toHaveLength(2);
      expect(result.actions?.[0]).toMatchObject({
        operation: 'create',
        type: 'task',
        data: { title: 'Task 1', status: 'todo' }
      });
    });

    it('should handle propose_operations without text message', () => {
      const mockResponse: Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'propose_operations',
            input: {
              summary: 'Creating task',
              operations: [
                {
                  operation: 'create',
                  type: 'task',
                  data: { title: 'Task 1' }
                }
              ]
            }
          }
        ],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      const result = parseAIResponse(mockResponse);

      expect(result.type).toBe('actions');
      expect(result.message).toBe('');
      expect(result.summary).toBe('Creating task');
      expect(result.actions).toHaveLength(1);
    });

    it('should parse update operation', () => {
      const mockResponse: Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'propose_operations',
            input: {
              summary: 'Updating task status',
              operations: [
                {
                  operation: 'update',
                  type: 'task',
                  id: 'task_123',
                  changes: { status: 'completed' },
                  reason: 'Task marked as done'
                }
              ]
            }
          }
        ],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      const result = parseAIResponse(mockResponse);

      expect(result.type).toBe('actions');
      expect(result.actions?.[0]).toMatchObject({
        operation: 'update',
        type: 'task',
        id: 'task_123',
        changes: { status: 'completed' }
      });
    });

    it('should parse delete operation', () => {
      const mockResponse: Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'propose_operations',
            input: {
              summary: 'Deleting old tasks',
              operations: [
                {
                  operation: 'delete',
                  type: 'task',
                  id: 'task_123',
                  reason: 'No longer needed'
                }
              ]
            }
          }
        ],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      const result = parseAIResponse(mockResponse);

      expect(result.type).toBe('actions');
      expect(result.actions?.[0]).toMatchObject({
        operation: 'delete',
        type: 'task',
        id: 'task_123'
      });
    });
  });

  describe('parseAIResponse - Tool Use: ask_questions', () => {
    it('should parse ask_questions tool use', () => {
      const mockResponse: Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I need more information to help you.'
          },
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'ask_questions',
            input: {
              questions: [
                {
                  question: 'What priority should this task have?',
                  options: ['low', 'medium', 'high']
                },
                {
                  question: 'When is this due?',
                  type: 'date'
                }
              ]
            }
          }
        ],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 30 }
      };

      const result = parseAIResponse(mockResponse);

      expect(result.type).toBe('questions');
      expect(result.message).toBe('I need more information to help you.');
      expect(result.questions).toHaveLength(2);
      expect(result.questions?.[0]).toMatchObject({
        question: 'What priority should this task have?',
        options: ['low', 'medium', 'high']
      });
    });

    it('should handle ask_questions without text message', () => {
      const mockResponse: Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'ask_questions',
            input: {
              questions: [
                {
                  question: 'What is the task title?',
                  type: 'text'
                }
              ]
            }
          }
        ],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      const result = parseAIResponse(mockResponse);

      expect(result.type).toBe('questions');
      expect(result.message).toBe('');
      expect(result.questions).toHaveLength(1);
    });
  });

  describe('parseAIResponse - Edge Cases', () => {
    it('should handle tool_use stop_reason without tool block', () => {
      const mockResponse: Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Just a message'
          }
        ],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'tool_use', // Says tool_use but no tool block
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      const result = parseAIResponse(mockResponse);

      // Should fall back to message type
      expect(result.type).toBe('message');
      expect(result.message).toBe('Just a message');
    });

    it('should handle unknown tool name', () => {
      const mockResponse: Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'unknown_tool',
            input: {}
          }
        ],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      const result = parseAIResponse(mockResponse);

      // Should fall back to message type
      expect(result.type).toBe('message');
      expect(result.message).toBe('');
    });

    it('should handle non-text first content block', () => {
      const mockResponse: Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'thinking',  // Not a text block
            text: 'Internal thoughts'
          } as never
        ],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      const result = parseAIResponse(mockResponse);

      expect(result.type).toBe('message');
      expect(result.message).toBe('');  // No text block found
    });
  });
});
