import { describe, it, expect } from 'vitest';
import { getCorsHeaders, handlePreflight } from '../../src/middleware/cors';
import type { Env } from '../../src/types';

describe('CORS Middleware', () => {
  const mockEnv: Env = {
    ANTHROPIC_API_KEY: 'test-key',
    SUPABASE_URL: 'http://test',
    SUPABASE_ANON_KEY: 'test-key',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CHATKIN_BUCKET: {} as any
  };

  describe('getCorsHeaders', () => {
    it('should return allowed origin if in whitelist', () => {
      const request = new Request('http://localhost', {
        headers: { 'Origin': 'http://localhost:5173' }
      });

      const headers = getCorsHeaders(request, mockEnv);

      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
      expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, DELETE, OPTIONS');
      expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should fallback to first allowed origin if origin not in whitelist', () => {
      const request = new Request('http://localhost', {
        headers: { 'Origin': 'http://evil.com' }
      });

      const headers = getCorsHeaders(request, mockEnv);

      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    });

    it('should use custom allowed origins from env', () => {
      const customEnv: Env = {
        ...mockEnv,
        ALLOWED_ORIGINS: 'http://custom1.com,http://custom2.com'
      };

      const request = new Request('http://localhost', {
        headers: { 'Origin': 'http://custom1.com' }
      });

      const headers = getCorsHeaders(request, customEnv);

      expect(headers['Access-Control-Allow-Origin']).toBe('http://custom1.com');
    });

    it('should handle missing origin header', () => {
      const request = new Request('http://localhost');

      const headers = getCorsHeaders(request, mockEnv);

      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    });
  });

  describe('handlePreflight', () => {
    it('should return 200 response with CORS headers', () => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      };

      const response = handlePreflight(corsHeaders);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    });
  });
});
