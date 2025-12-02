/**
 * AI Orchestration Service
 * Handles tool execution loop, message formatting, and Claude API interactions
 *
 * Key features:
 * - Parallel tool execution (Claude 3.5 can call multiple tools simultaneously)
 * - Streaming-ready architecture (interface designed for future streaming implementation)
 * - Client-side vs server-side tool detection
 * - Comprehensive error handling
 */

import type { Anthropic } from '@anthropic-ai/sdk';
import type { MessageParam, Message } from '@anthropic-ai/sdk/resources/messages';
import type { Env } from '../types';
import { logger } from '../utils/logger';
import { executeQueryTool } from '../ai/query-handlers';
import { parseAIResponse, type AIResponse } from '../ai/response-handler';

export interface OrchestratorConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  tools: any[]; // Anthropic tool definitions
  maxIterations?: number;
}

export interface OrchestratorContext {
  authToken?: string;
  env: Env;
}

/**
 * Streaming chunk types (designed now, implemented in Phase 7)
 */
export type StreamChunk =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use_start'; tool: string }
  | { type: 'tool_use_result'; tool: string; result: unknown };

const DEFAULT_MAX_ITERATIONS = 5;
const CLIENT_SIDE_TOOLS = ['ask_questions', 'propose_operations'];

/**
 * Tool result type for Anthropic API
 */
interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export class AIOrchestrator {
  private client: Anthropic;
  private config: OrchestratorConfig;
  private context: OrchestratorContext;

  constructor(
    client: Anthropic,
    config: OrchestratorConfig,
    context: OrchestratorContext
  ) {
    this.client = client;
    this.config = config;
    this.context = context;
  }

  /**
   * Execute tool use loop with Claude (non-streaming)
   * Returns when AI completes response or uses a client-side tool
   */
  async executeToolLoop(initialMessages: MessageParam[]): Promise<AIResponse> {
    const maxIterations = this.config.maxIterations || DEFAULT_MAX_ITERATIONS;
    let currentMessages = [...initialMessages];
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      logger.debug('Tool use loop iteration', { iteration: iterations });

      // Call Claude API (non-streaming)
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.config.systemPrompt,
        messages: currentMessages,
        tools: this.config.tools,
      });

      logger.debug('AI response generated', {
        stopReason: response.stop_reason,
        contentBlocks: response.content.length,
        iteration: iterations
      });

      // AI finished - return response
      if (response.stop_reason === 'end_turn') {
        return parseAIResponse(response);
      }

      // AI wants to use tools
      if (response.stop_reason === 'tool_use') {
        // Check for client-side tools (must return immediately)
        if (this.hasClientSideTool(response)) {
          logger.debug('Client-side tool detected, returning response immediately', {
            iteration: iterations,
            tools: this.getToolNames(response)
          });
          return parseAIResponse(response);
        }

        // Execute server-side tools IN PARALLEL
        const toolResults = await this.executeTools(response);

        // Add assistant response and tool results to conversation
        currentMessages.push({
          role: 'assistant',
          content: response.content
        });

        currentMessages.push({
          role: 'user',
          content: toolResults
        });

        // Continue loop - AI will process results
        continue;
      }

      // Unexpected stop reason
      logger.error('Unexpected stop reason', { stopReason: response.stop_reason });
      throw new Error(`Unexpected stop reason: ${response.stop_reason}`);
    }

    // Max iterations reached
    logger.warn('Max tool use iterations reached', { iterations: maxIterations });
    throw new Error(
      'The AI made too many tool calls. Please try rephrasing your request or breaking it into smaller questions.'
    );
  }

  /**
   * Execute tool use loop with Claude (streaming)
   * Yields chunks as they arrive from Claude API
   *
   * NOTE: Interface designed in Phase 2, implementation in Phase 7
   */
  async *executeToolLoopStream(
    initialMessages: MessageParam[]
  ): AsyncGenerator<StreamChunk, AIResponse> {
    const maxIterations = this.config.maxIterations || DEFAULT_MAX_ITERATIONS;
    let currentMessages = [...initialMessages];
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      // Use streaming API
      const stream = await this.client.messages.stream({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.config.systemPrompt,
        messages: currentMessages,
        tools: this.config.tools,
      });

      // Yield text chunks as they arrive
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield { type: 'text_delta', delta: chunk.delta.text };
        }

        if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
          yield { type: 'tool_use_start', tool: chunk.content_block.name };
        }
      }

      const response = await stream.finalMessage();

      // Handle tool execution (non-streaming, wait for all tools)
      if (response.stop_reason === 'tool_use') {
        if (this.hasClientSideTool(response)) {
          return parseAIResponse(response);
        }

        const toolResults = await this.executeTools(response); // Uses parallel execution

        // Yield tool results
        for (const result of toolResults) {
          yield { type: 'tool_use_result', tool: result.tool_use_id, result: JSON.parse(result.content) };
        }

        // Continue loop
        currentMessages.push({ role: 'assistant', content: response.content });
        currentMessages.push({ role: 'user', content: toolResults });
        continue;
      }

      if (response.stop_reason === 'end_turn') {
        return parseAIResponse(response);
      }

      throw new Error(`Unexpected stop reason: ${response.stop_reason}`);
    }

    throw new Error('Max iterations reached');
  }

  /**
   * Check if response contains client-side tools
   */
  private hasClientSideTool(response: Message): boolean {
    return response.content.some(
      block => block.type === 'tool_use' && CLIENT_SIDE_TOOLS.includes((block as any).name)
    );
  }

  /**
   * Get list of tool names from response
   */
  private getToolNames(response: Message): string[] {
    return response.content
      .filter(block => block.type === 'tool_use')
      .map(block => (block as any).name);
  }

  /**
   * Execute all server-side tools in a response IN PARALLEL
   * CRITICAL: Uses Promise.all to execute multiple tools simultaneously
   * This is essential for Claude 3.5 which can call multiple tools at once
   */
  private async executeTools(response: Message): Promise<ToolResult[]> {
    const toolBlocks = response.content.filter(block => block.type === 'tool_use');

    logger.debug('Executing tools in parallel', {
      toolCount: toolBlocks.length,
      tools: toolBlocks.map((block: any) => block.name)
    });

    // Execute all tools in parallel using Promise.all
    const results = await Promise.all(
      toolBlocks.map(async (block: any) => {
        const { id, name, input } = block;

        try {
          const result = await this.executeSingleTool(name, input as any);
          return {
            type: 'tool_result' as const,
            tool_use_id: id,
            content: result
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Tool execution error', { toolName: name, error: errorMessage });

          return {
            type: 'tool_result' as const,
            tool_use_id: id,
            content: JSON.stringify({
              error: true,
              message: `Error: ${errorMessage}. Please try again.`
            }),
            is_error: true
          };
        }
      })
    );

    logger.debug('Tool execution completed', {
      successCount: results.filter(r => !r.is_error).length,
      errorCount: results.filter(r => r.is_error).length
    });

    return results;
  }

  /**
   * Execute a single tool
   */
  private async executeSingleTool(
    toolName: string,
    input: { filters?: Record<string, unknown>; limit?: number }
  ): Promise<string> {
    logger.debug('Executing tool', { toolName, input });

    // Query tools
    const queryTools = ['query_tasks', 'query_notes', 'query_projects', 'query_files'];

    if (queryTools.includes(toolName)) {
      if (!this.context.authToken) {
        return JSON.stringify({
          error: true,
          message: 'Authentication required to query database. Please ensure you are logged in.'
        });
      }

      return executeQueryTool(toolName, input, this.context.authToken, this.context.env);
    }

    // Unknown tool
    logger.warn('Unknown tool encountered', { toolName });
    throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Factory function to create orchestrator
 */
export function createAIOrchestrator(
  client: Anthropic,
  config: OrchestratorConfig,
  context: OrchestratorContext
): AIOrchestrator {
  return new AIOrchestrator(client, config, context);
}
