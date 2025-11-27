import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAIChat } from '../../src/routes/ai-chat';
import type { CorsHeaders, Env } from '../../src/types';
import type { ChatRequest } from '@chatkin/types/api';

// Mock dependencies
vi.mock('../../src/ai/client', () => ({
  createAnthropicClient: vi.fn(() => ({
    messages: {
      create: vi.fn()
    }
  }))
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('AI Chat Endpoint', () => {
  const corsHeaders: CorsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  const mockEnv: Env = {
    ANTHROPIC_API_KEY: 'test-api-key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    CHATKIN_BUCKET: {} as never,
    ALLOWED_ORIGINS: 'http://localhost:5173'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject non-POST requests', async () => {
    const request = new Request('http://localhost/ai-chat', {
      method: 'GET'
    });

    const response = await handleAIChat(request, mockEnv, corsHeaders);

    expect(response.status).toBe(405);
    const data = await response.json();
    expect(data).toEqual({ error: 'Method not allowed' });
  });

  it('should reject requests without message', async () => {
    const request = new Request('http://localhost/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({} as ChatRequest)
    });

    const response = await handleAIChat(request, mockEnv, corsHeaders);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should process simple message request', async () => {
    const { createAnthropicClient } = await import('../../src/ai/client');
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Hello! How can I help you?' }],
      stop_reason: 'end_turn'
    });

    vi.mocked(createAnthropicClient).mockReturnValue({
      messages: { create: mockCreate }
    } as never);

    const chatRequest: ChatRequest = {
      message: 'Hello',
      context: { scope: 'global' }
    };

    const request = new Request('http://localhost/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatRequest)
    });

    const response = await handleAIChat(request, mockEnv, corsHeaders);

    expect(response.status).toBe(200);
    expect(mockCreate).toHaveBeenCalled();

    const data = await response.json();
    expect(data.type).toBe('message');
    expect(data.message).toBe('Hello! How can I help you?');
  });

  it('should include conversation history in request', async () => {
    const { createAnthropicClient } = await import('../../src/ai/client');
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      stop_reason: 'end_turn'
    });

    vi.mocked(createAnthropicClient).mockReturnValue({
      messages: { create: mockCreate }
    } as never);

    const chatRequest: ChatRequest = {
      message: 'Follow up',
      conversationHistory: [
        { role: 'user', content: 'Hello' },
        { role: 'ai', content: 'Hi there!' }
      ],
      context: { scope: 'global' }
    };

    const request = new Request('http://localhost/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatRequest)
    });

    await handleAIChat(request, mockEnv, corsHeaders);

    expect(mockCreate).toHaveBeenCalled();
    const callArgs = mockCreate.mock.calls[0][0];

    // Should have 3 messages: original user, AI response, and new user message
    expect(callArgs.messages).toHaveLength(3);
    expect(callArgs.messages[0].content).toBe('Hello');
    expect(callArgs.messages[1].content).toBe('Hi there!');
    expect(callArgs.messages[2].content).toBe('Follow up');
  });

  it('should include conversation summary when provided', async () => {
    const { createAnthropicClient } = await import('../../src/ai/client');
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      stop_reason: 'end_turn'
    });

    vi.mocked(createAnthropicClient).mockReturnValue({
      messages: { create: mockCreate }
    } as never);

    const chatRequest: ChatRequest = {
      message: 'New question',
      conversationSummary: 'Previous discussion about tasks',
      context: { scope: 'global' }
    };

    const request = new Request('http://localhost/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatRequest)
    });

    await handleAIChat(request, mockEnv, corsHeaders);

    expect(mockCreate).toHaveBeenCalled();
    const callArgs = mockCreate.mock.calls[0][0];

    // First message should contain summary
    expect(callArgs.messages[0].content).toContain('Previous discussion about tasks');
  });

  it('should skip initial AI greeting in conversation history', async () => {
    const { createAnthropicClient } = await import('../../src/ai/client');
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      stop_reason: 'end_turn'
    });

    vi.mocked(createAnthropicClient).mockReturnValue({
      messages: { create: mockCreate }
    } as never);

    const chatRequest: ChatRequest = {
      message: 'Hello',
      conversationHistory: [
        { role: 'ai', content: 'Welcome! How can I help?' } // Initial AI greeting
      ],
      context: { scope: 'global' }
    };

    const request = new Request('http://localhost/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatRequest)
    });

    await handleAIChat(request, mockEnv, corsHeaders);

    expect(mockCreate).toHaveBeenCalled();
    const callArgs = mockCreate.mock.calls[0][0];

    // Should only have the new user message (AI greeting skipped)
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0].content).toBe('Hello');
  });

  it('should build correct system prompt for different scopes', async () => {
    const { createAnthropicClient } = await import('../../src/ai/client');
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      stop_reason: 'end_turn'
    });

    vi.mocked(createAnthropicClient).mockReturnValue({
      messages: { create: mockCreate }
    } as never);

    const chatRequest: ChatRequest = {
      message: 'Test',
      context: { scope: 'tasks' }
    };

    const request = new Request('http://localhost/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatRequest)
    });

    await handleAIChat(request, mockEnv, corsHeaders);

    expect(mockCreate).toHaveBeenCalled();
    const callArgs = mockCreate.mock.calls[0][0];

    // System prompt should include tasks-specific content
    expect(callArgs.system).toContain('TASKS AI assistant');
  });

  it('should include tools in API request', async () => {
    const { createAnthropicClient } = await import('../../src/ai/client');
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      stop_reason: 'end_turn'
    });

    vi.mocked(createAnthropicClient).mockReturnValue({
      messages: { create: mockCreate }
    } as never);

    const chatRequest: ChatRequest = {
      message: 'Create a task',
      context: { scope: 'global' }
    };

    const request = new Request('http://localhost/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatRequest)
    });

    await handleAIChat(request, mockEnv, corsHeaders);

    expect(mockCreate).toHaveBeenCalled();
    const callArgs = mockCreate.mock.calls[0][0];

    // Should include tool definitions
    expect(callArgs.tools).toBeDefined();
    expect(Array.isArray(callArgs.tools)).toBe(true);
  });

  it('should include CORS headers in response', async () => {
    const { createAnthropicClient } = await import('../../src/ai/client');
    vi.mocked(createAnthropicClient).mockReturnValue({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Response' }],
          stop_reason: 'end_turn'
        })
      }
    } as never);

    const chatRequest: ChatRequest = {
      message: 'Test',
      context: { scope: 'global' }
    };

    const request = new Request('http://localhost/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatRequest)
    });

    const response = await handleAIChat(request, mockEnv, corsHeaders);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('should handle errors gracefully', async () => {
    const { createAnthropicClient } = await import('../../src/ai/client');
    vi.mocked(createAnthropicClient).mockReturnValue({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('API Error'))
      }
    } as never);

    const chatRequest: ChatRequest = {
      message: 'Test',
      context: { scope: 'global' }
    };

    const request = new Request('http://localhost/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatRequest)
    });

    const response = await handleAIChat(request, mockEnv, corsHeaders);

    expect(response.status).toBeGreaterThanOrEqual(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});
