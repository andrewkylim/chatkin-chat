/**
 * Authentication middleware for Cloudflare Workers
 * Verifies Supabase JWT tokens
 */

import type { Env, CorsHeaders } from '../types';
import { WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';

export interface AuthenticatedUser {
  userId: string;
  email?: string;
}

interface SupabaseUserResponse {
  id: string;
  email?: string;
  aud?: string;
  role?: string;
}

/**
 * Verify Supabase JWT token and extract user information
 */
export async function verifySupabaseToken(
  token: string,
  env: Env
): Promise<AuthenticatedUser> {
  try {
    // Supabase JWT tokens can be verified by calling Supabase's auth.getUser() API
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': env.SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn('Token verification failed', {
        status: response.status,
        error: errorText
      });
      throw new WorkerError('Invalid or expired authentication token', 401);
    }

    const userData = await response.json() as SupabaseUserResponse;

    if (!userData || !userData.id) {
      throw new WorkerError('Invalid token payload', 401);
    }

    return {
      userId: userData.id,
      email: userData.email,
    };
  } catch (error) {
    if (error instanceof WorkerError) {
      throw error;
    }
    logger.error('Token verification error', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new WorkerError('Authentication failed', 401);
  }
}

/**
 * Extract and verify authentication token from request
 */
export async function requireAuth(
  request: Request,
  env: Env
): Promise<AuthenticatedUser> {
  // Extract token from Authorization header
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    throw new WorkerError('Authentication required. Please log in.', 401);
  }

  // Support both "Bearer <token>" and "<token>" formats
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  if (!token) {
    throw new WorkerError('Authentication token is missing', 401);
  }

  // Verify token and get user
  return await verifySupabaseToken(token, env);
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(
  message: string,
  corsHeaders: CorsHeaders
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      requiresAuth: true
    }),
    {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
    }
  );
}
