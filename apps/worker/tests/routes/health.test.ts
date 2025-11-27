import { describe, it, expect } from 'vitest';
import { handleHealth } from '../../src/routes/health';
import type { CorsHeaders } from '../../src/types';

describe('Health Endpoint', () => {
  const corsHeaders: CorsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  it('should return status ok', async () => {
    const response = handleHealth(corsHeaders);

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ status: 'ok' });
  });

  it('should include CORS headers', () => {
    const response = handleHealth(corsHeaders);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});
