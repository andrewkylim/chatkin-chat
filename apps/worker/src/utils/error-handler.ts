/**
 * Centralized error handling for Cloudflare Workers
 */

import { logger } from './logger';
import type { CorsHeaders } from '../types';

export class WorkerError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

export function handleError(
  error: unknown,
  context: string,
  corsHeaders: CorsHeaders
): Response {
  logger.error(context, error);

  if (error instanceof WorkerError) {
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.details
      }),
      {
        status: error.statusCode,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  // Generic error response
  return new Response(
    JSON.stringify({
      error: 'Internal server error',
      message: context,
      details: error instanceof Error ? error.message : 'Unknown error'
    }),
    {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  );
}
