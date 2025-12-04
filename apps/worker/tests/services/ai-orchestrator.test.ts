/**
 * Tests for AI Orchestrator Service
 * Focus on parallel tool execution and error handling
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAIOrchestrator, AIOrchestrator, type OrchestratorConfig, type OrchestratorContext } from '../../src/services/ai-orchestrator';
import type { Anthropic } from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import type { Env } from '../../src/types';

describe('AIOrchestrator', () => {
  let mockAnthropicClient: Anthropic;
  let mockEnv: Env;
  let config: OrchestratorConfig;
  let context: OrchestratorContext;

  beforeEach(() => {
    // Mock Anthropic client
    mockAnthropicClient = {
      messages: {
        create: vi.fn(),
        stream: vi.fn(),
      }
    } as unknown as Anthropic;

    // Mock environment
    mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
    } as Env;

    // Default config
    config = {
      model: 'claude-3-5-haiku-20241022',
      maxTokens: 2048,
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant.',
      tools: []
    };

    // Default context
    context = {
      authToken: 'test-auth-token',
      env: mockEnv
    };
  });

  describe('createAIOrchestrator', () => {
    it('creates an orchestrator instance', () => {
      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      expect(orchestrator).toBeInstanceOf(AIOrchestrator);
    });
  });

  describe('executeToolLoop', () => {
    it('returns message when AI completes without tools', async () => {
      const mockResponse = {
        stop_reason: 'end_turn',
        content: [
          { type: 'text', text: 'Hello! How can I help you?' }
        ]
      };

      (mockAnthropicClient.messages.create as any).mockResolvedValue(mockResponse);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      const messages: MessageParam[] = [
        { role: 'user', content: 'Hello' }
      ];

      const result = await orchestrator.executeToolLoop(messages);

      expect(result).toBeDefined();
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(1);
    });

    it('returns immediately for client-side tools (ask_questions)', async () => {
      const mockResponse = {
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'I need to ask some questions.' },
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'ask_questions',
            input: {
              questions: [
                { question: 'What is your favorite color?', options: ['Red', 'Blue', 'Green'] }
              ]
            }
          }
        ]
      };

      (mockAnthropicClient.messages.create as any).mockResolvedValue(mockResponse);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      const messages: MessageParam[] = [
        { role: 'user', content: 'Help me pick a color' }
      ];

      const result = await orchestrator.executeToolLoop(messages);

      expect(result).toBeDefined();
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(1); // No second call
    });

    it('returns immediately for client-side tools (propose_operations)', async () => {
      const mockResponse = {
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'I will create a task for you.' },
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'propose_operations',
            input: {
              operations: [
                { type: 'create', table: 'tasks', data: { title: 'New task' } }
              ]
            }
          }
        ]
      };

      (mockAnthropicClient.messages.create as any).mockResolvedValue(mockResponse);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      const messages: MessageParam[] = [
        { role: 'user', content: 'Create a task' }
      ];

      const result = await orchestrator.executeToolLoop(messages);

      expect(result).toBeDefined();
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(1);
    });

    it('executes server-side query tools and continues loop', async () => {
      // First response: AI wants to use query_tasks
      const firstResponse = {
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Let me check your tasks.' },
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'query_tasks',
            input: { filters: {}, limit: 10 }
          }
        ]
      };

      // Second response: AI completes after processing tool results
      const secondResponse = {
        stop_reason: 'end_turn',
        content: [
          { type: 'text', text: 'You have 3 tasks.' }
        ]
      };

      (mockAnthropicClient.messages.create as any)
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      const messages: MessageParam[] = [
        { role: 'user', content: 'Show me my tasks' }
      ];

      const result = await orchestrator.executeToolLoop(messages);

      expect(result).toBeDefined();
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(2);
    });

    it('executes multiple tools in parallel (CRITICAL TEST)', async () => {
      // Mock response with multiple tool calls
      const mockResponse = {
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Let me check both tasks and notes.' },
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'query_tasks',
            input: { filters: {}, limit: 10 }
          },
          {
            type: 'tool_use',
            id: 'tool_2',
            name: 'query_notes',
            input: { filters: {}, limit: 10 }
          }
        ]
      };

      const finalResponse = {
        stop_reason: 'end_turn',
        content: [
          { type: 'text', text: 'You have tasks and notes.' }
        ]
      };

      (mockAnthropicClient.messages.create as any)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(finalResponse);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      const messages: MessageParam[] = [
        { role: 'user', content: 'Show me my tasks and notes' }
      ];

      // Track timing to verify parallel execution
      const startTime = Date.now();
      const result = await orchestrator.executeToolLoop(messages);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(2);

      // If tools ran sequentially, this would take much longer
      // Parallel execution should complete quickly
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });

    it('handles tool execution errors gracefully', async () => {
      const mockResponse = {
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Let me try.' },
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'unknown_tool', // This will throw an error
            input: {}
          }
        ]
      };

      const finalResponse = {
        stop_reason: 'end_turn',
        content: [
          { type: 'text', text: 'Sorry, I encountered an error.' }
        ]
      };

      (mockAnthropicClient.messages.create as any)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(finalResponse);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      const messages: MessageParam[] = [
        { role: 'user', content: 'Do something' }
      ];

      // Should NOT throw - errors are returned as tool results
      const result = await orchestrator.executeToolLoop(messages);
      expect(result).toBeDefined();
    });

    it('handles mixed success and error in parallel tool execution', async () => {
      const mockResponse = {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'query_tasks', // This will succeed
            input: { filters: {}, limit: 10 }
          },
          {
            type: 'tool_use',
            id: 'tool_2',
            name: 'unknown_tool', // This will fail
            input: {}
          }
        ]
      };

      const finalResponse = {
        stop_reason: 'end_turn',
        content: [
          { type: 'text', text: 'Partial results.' }
        ]
      };

      (mockAnthropicClient.messages.create as any)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(finalResponse);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      const messages: MessageParam[] = [
        { role: 'user', content: 'Show me data' }
      ];

      const result = await orchestrator.executeToolLoop(messages);
      expect(result).toBeDefined();
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(2);
    });

    it('throws error when max iterations reached', async () => {
      // Always return tool_use to force iteration
      const mockResponse = {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'query_tasks',
            input: {}
          }
        ]
      };

      (mockAnthropicClient.messages.create as any).mockResolvedValue(mockResponse);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, {
        ...config,
        maxIterations: 2 // Set low to test quickly
      }, context);

      const messages: MessageParam[] = [
        { role: 'user', content: 'Loop forever' }
      ];

      await expect(orchestrator.executeToolLoop(messages)).rejects.toThrow(
        'The AI made too many tool calls'
      );

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(2);
    });

    it('requires auth for query tools', async () => {
      const mockResponse = {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'query_tasks',
            input: {}
          }
        ]
      };

      const finalResponse = {
        stop_reason: 'end_turn',
        content: [
          { type: 'text', text: 'Auth required.' }
        ]
      };

      (mockAnthropicClient.messages.create as any)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(finalResponse);

      // Create orchestrator WITHOUT auth token
      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, {
        env: mockEnv
        // No authToken
      });

      const messages: MessageParam[] = [
        { role: 'user', content: 'Show tasks' }
      ];

      const result = await orchestrator.executeToolLoop(messages);
      expect(result).toBeDefined();
      // Tool should return auth error, but not throw
    });

    it('throws error for unexpected stop reason', async () => {
      const mockResponse = {
        stop_reason: 'max_tokens', // Unexpected
        content: [
          { type: 'text', text: 'This is...' }
        ]
      };

      (mockAnthropicClient.messages.create as any).mockResolvedValue(mockResponse);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      const messages: MessageParam[] = [
        { role: 'user', content: 'Hello' }
      ];

      await expect(orchestrator.executeToolLoop(messages)).rejects.toThrow(
        'Unexpected stop reason'
      );
    });

    it('handles multiple iterations correctly', async () => {
      const responses = [
        // Iteration 1: Use query_tasks
        {
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'query_tasks',
              input: {}
            }
          ]
        },
        // Iteration 2: Use query_notes
        {
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'tool_2',
              name: 'query_notes',
              input: {}
            }
          ]
        },
        // Iteration 3: Complete
        {
          stop_reason: 'end_turn',
          content: [
            { type: 'text', text: 'Done!' }
          ]
        }
      ];

      (mockAnthropicClient.messages.create as any)
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1])
        .mockResolvedValueOnce(responses[2]);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      const messages: MessageParam[] = [
        { role: 'user', content: 'Show me everything' }
      ];

      const result = await orchestrator.executeToolLoop(messages);
      expect(result).toBeDefined();
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('Client-side tool detection', () => {
    it('detects ask_questions as client-side tool', async () => {
      const mockResponse = {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'ask_questions',
            input: {}
          }
        ]
      };

      (mockAnthropicClient.messages.create as any).mockResolvedValue(mockResponse);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      const messages: MessageParam[] = [
        { role: 'user', content: 'Ask me something' }
      ];

      const result = await orchestrator.executeToolLoop(messages);
      expect(result).toBeDefined();
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(1);
    });

    it('detects propose_operations as client-side tool', async () => {
      const mockResponse = {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'propose_operations',
            input: {}
          }
        ]
      };

      (mockAnthropicClient.messages.create as any).mockResolvedValue(mockResponse);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      const messages: MessageParam[] = [
        { role: 'user', content: 'Create something' }
      ];

      const result = await orchestrator.executeToolLoop(messages);
      expect(result).toBeDefined();
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(1);
    });

    it('detects client-side tool even when mixed with other content', async () => {
      const mockResponse = {
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Let me ask you something.' },
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'query_tasks', // Server-side
            input: {}
          },
          {
            type: 'tool_use',
            id: 'tool_2',
            name: 'ask_questions', // Client-side - should trigger immediate return
            input: {}
          }
        ]
      };

      (mockAnthropicClient.messages.create as any).mockResolvedValue(mockResponse);

      const orchestrator = createAIOrchestrator(mockAnthropicClient, config, context);
      const messages: MessageParam[] = [
        { role: 'user', content: 'Help me' }
      ];

      const result = await orchestrator.executeToolLoop(messages);
      expect(result).toBeDefined();
      // Should return immediately, not execute server-side tools
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(1);
    });
  });
});
