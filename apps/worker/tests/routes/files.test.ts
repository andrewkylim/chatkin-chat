import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFileRetrieval } from '../../src/routes/files';
import type { CorsHeaders, Env } from '../../src/types';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('File Retrieval Endpoint', () => {
  const corsHeaders: CorsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  let mockEnv: Env;
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet = vi.fn();

    mockEnv = {
      ANTHROPIC_API_KEY: 'test-api-key',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      CHATKIN_BUCKET: {
        put: vi.fn(),
        get: mockGet,
        delete: vi.fn(),
        head: vi.fn(),
        list: vi.fn()
      } as never,
      ALLOWED_ORIGINS: 'http://localhost:5173'
    };
  });

  it('should retrieve file successfully', async () => {
    const mockFileContent = 'test file content';
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(mockFileContent));
        controller.close();
      }
    });

    mockGet.mockResolvedValue({
      body: mockStream,
      httpMetadata: {
        contentType: 'text/plain'
      }
    });

    const response = await handleFileRetrieval('test-file.txt', mockEnv, corsHeaders);

    expect(response.status).toBe(200);
    expect(mockGet).toHaveBeenCalledWith('test-file.txt');
    expect(response.headers.get('Content-Type')).toBe('text/plain');
  });

  it('should return 404 when file not found', async () => {
    mockGet.mockResolvedValue(null);

    const response = await handleFileRetrieval('nonexistent.txt', mockEnv, corsHeaders);

    expect(response.status).toBe(404);
    const data = await response.json() as { error?: string };
    expect(data.error).toBeDefined();
  });

  it('should set cache headers', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('content'));
        controller.close();
      }
    });

    mockGet.mockResolvedValue({
      body: mockStream,
      httpMetadata: {
        contentType: 'image/png'
      }
    });

    const response = await handleFileRetrieval('image.png', mockEnv, corsHeaders);

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000');
  });

  it('should include CORS headers', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('content'));
        controller.close();
      }
    });

    mockGet.mockResolvedValue({
      body: mockStream,
      httpMetadata: {
        contentType: 'text/plain'
      }
    });

    const response = await handleFileRetrieval('test.txt', mockEnv, corsHeaders);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('should handle different content types', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      }
    });

    mockGet.mockResolvedValue({
      body: mockStream,
      httpMetadata: {
        contentType: 'application/pdf'
      }
    });

    const response = await handleFileRetrieval('document.pdf', mockEnv, corsHeaders);

    expect(response.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('should default to octet-stream when no content type', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      }
    });

    mockGet.mockResolvedValue({
      body: mockStream,
      httpMetadata: undefined
    });

    const response = await handleFileRetrieval('unknown-file', mockEnv, corsHeaders);

    expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
  });

  it('should handle empty httpMetadata', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      }
    });

    mockGet.mockResolvedValue({
      body: mockStream,
      httpMetadata: {}
    });

    const response = await handleFileRetrieval('file.bin', mockEnv, corsHeaders);

    expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
  });

  it('should handle R2 errors', async () => {
    mockGet.mockRejectedValue(new Error('R2 Error'));

    const response = await handleFileRetrieval('test.txt', mockEnv, corsHeaders);

    expect(response.status).toBeGreaterThanOrEqual(400);
    const data = await response.json() as { error?: string };
    expect(data.error).toBeDefined();
  });

  it('should retrieve image files', async () => {
    const mockImageData = new Uint8Array([137, 80, 78, 71]); // PNG header
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(mockImageData);
        controller.close();
      }
    });

    mockGet.mockResolvedValue({
      body: mockStream,
      httpMetadata: {
        contentType: 'image/png'
      }
    });

    const response = await handleFileRetrieval('photo.png', mockEnv, corsHeaders);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  it('should retrieve JSON files', async () => {
    const mockJsonData = JSON.stringify({ test: 'data' });
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(mockJsonData));
        controller.close();
      }
    });

    mockGet.mockResolvedValue({
      body: mockStream,
      httpMetadata: {
        contentType: 'application/json'
      }
    });

    const response = await handleFileRetrieval('data.json', mockEnv, corsHeaders);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('should handle special characters in filename', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('content'));
        controller.close();
      }
    });

    mockGet.mockResolvedValue({
      body: mockStream,
      httpMetadata: {
        contentType: 'text/plain'
      }
    });

    const fileName = '1234567890-abc123def456.txt';
    const response = await handleFileRetrieval(fileName, mockEnv, corsHeaders);

    expect(response.status).toBe(200);
    expect(mockGet).toHaveBeenCalledWith(fileName);
  });
});
