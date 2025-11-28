import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleUpload } from '../../src/routes/upload';
import type { CorsHeaders, Env } from '../../src/types';

// Test response types
interface ErrorResponse {
  error: string;
}

interface UploadSuccessResponse {
  success: boolean;
  file: {
    name: string;
    originalName: string;
    url: string;
    type: string;
    size: number;
    temporary?: boolean;
  };
}

// Mock authentication
vi.mock('../../src/middleware/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    userId: 'test-user-id',
    email: 'test@example.com'
  })
}));

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock moderation utilities
vi.mock('../../src/utils/moderation', () => ({
  moderateImageContent: vi.fn().mockResolvedValue({
    safe: true,
    riskLevel: 0,
    categories: []
  })
}));

// Mock file-metadata utilities
vi.mock('../../src/utils/file-metadata', () => ({
  generateImageMetadata: vi.fn().mockResolvedValue({
    title: 'Test Image',
    description: 'A test image'
  }),
  generateDocumentMetadata: vi.fn().mockReturnValue({
    title: 'Test Document',
    description: 'A test document'
  })
}));

// Mock AI client
vi.mock('../../src/ai/client', () => ({
  createAnthropicClient: vi.fn().mockReturnValue({})
}));

describe('Upload Endpoint', () => {
  const corsHeaders: CorsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  let mockEnv: Env;
  let mockPut: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPut = vi.fn().mockResolvedValue(undefined);

    mockEnv = {
      ANTHROPIC_API_KEY: 'test-api-key',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      PUBLIC_WORKER_URL: 'https://test.chatkin.ai',
      CHATKIN_BUCKET: {
        put: mockPut,
        get: vi.fn(),
        delete: vi.fn(),
        head: vi.fn(),
        list: vi.fn()
      } as never,
      CHATKIN_TEMP_BUCKET: {
        put: mockPut,
        get: vi.fn(),
        delete: vi.fn(),
        head: vi.fn(),
        list: vi.fn()
      } as never,
      ALLOWED_ORIGINS: 'http://localhost:5173'
    };
  });

  it('should reject non-POST requests', async () => {
    const request = new Request('http://localhost/api/upload', {
      method: 'GET'
    });

    const response = await handleUpload(request, mockEnv, corsHeaders);

    expect(response.status).toBe(405);
    const data = await response.json() as ErrorResponse;
    expect(data).toEqual({ error: 'Method not allowed' });
  });

  it('should reject requests without file', async () => {
    const formData = new FormData();
    // No file added

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const response = await handleUpload(request, mockEnv, corsHeaders);

    expect(response.status).toBe(400);
    const data = await response.json() as ErrorResponse;
    expect(data.error).toBeDefined();
  });

  it('should reject requests with string instead of file', async () => {
    const formData = new FormData();
    formData.append('file', 'not-a-file');

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const response = await handleUpload(request, mockEnv, corsHeaders);

    expect(response.status).toBe(400);
    const data = await response.json() as ErrorResponse;
    expect(data.error).toBeDefined();
  });

  it('should upload file successfully', async () => {
    const fileContent = 'test file content';
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const response = await handleUpload(request, mockEnv, corsHeaders);

    expect(response.status).toBe(200);
    expect(mockPut).toHaveBeenCalled();

    const data = await response.json() as UploadSuccessResponse;
    expect(data.success).toBe(true);
    expect(data.file).toBeDefined();
    expect(data.file.originalName).toBe('test.txt');
    expect(data.file.type).toBe('text/plain');
    expect(data.file.size).toBe(fileContent.length);
  });

  it('should generate unique filename with timestamp', async () => {
    const blob = new Blob(['content'], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    await handleUpload(request, mockEnv, corsHeaders);

    expect(mockPut).toHaveBeenCalled();
    const uploadedFileName = mockPut.mock.calls[0][0];

    // Should contain timestamp and random string
    expect(uploadedFileName).toMatch(/^\d+-[a-z0-9]+\.txt$/);
  });

  it('should preserve file extension', async () => {
    const blob = new Blob(['content'], { type: 'application/pdf' });
    const file = new File([blob], 'document.pdf', { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const response = await handleUpload(request, mockEnv, corsHeaders);
    const data = await response.json() as UploadSuccessResponse;

    expect(data.file.name).toMatch(/\.pdf$/);
  });

  it('should set correct content type in R2', async () => {
    const blob = new Blob(['content'], { type: 'image/png' });
    const file = new File([blob], 'image.png', { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    await handleUpload(request, mockEnv, corsHeaders);

    expect(mockPut).toHaveBeenCalled();
    const uploadOptions = mockPut.mock.calls[0][2];

    expect(uploadOptions.httpMetadata.contentType).toBe('image/png');
  });

  it('should include CORS headers in response', async () => {
    const blob = new Blob(['content'], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const response = await handleUpload(request, mockEnv, corsHeaders);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('should return file URL in response', async () => {
    const blob = new Blob(['content'], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const response = await handleUpload(request, mockEnv, corsHeaders);
    const data = await response.json() as UploadSuccessResponse;

    // Files without permanent=true go to temp bucket
    expect(data.file.url).toMatch(/^https:\/\/test\.chatkin\.ai\/api\/temp-files\/.+\.txt$/);
    expect(data.file.temporary).toBe(true);
  });

  it('should handle R2 upload errors', async () => {
    mockPut.mockRejectedValue(new Error('R2 Error'));

    const blob = new Blob(['content'], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const response = await handleUpload(request, mockEnv, corsHeaders);

    expect(response.status).toBeGreaterThanOrEqual(400);
    const data = await response.json() as ErrorResponse;
    expect(data.error).toBeDefined();
  });

  it('should handle large file names correctly', async () => {
    const blob = new Blob(['content'], { type: 'text/plain' });
    const longFileName = 'a'.repeat(200) + '.txt';
    const file = new File([blob], longFileName, { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const response = await handleUpload(request, mockEnv, corsHeaders);

    expect(response.status).toBe(200);
    const data = await response.json() as UploadSuccessResponse;
    expect(data.file.originalName).toBe(longFileName);
  });

  it('should handle files with simple names', async () => {
    const blob = new Blob(['content'], { type: 'text/plain' });
    const file = new File([blob], 'README.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const response = await handleUpload(request, mockEnv, corsHeaders);

    expect(response.status).toBe(200);
    const data = await response.json() as UploadSuccessResponse;
    // Should generate a unique filename with timestamp
    expect(data.file.name).toBeDefined();
    expect(data.file.name).toMatch(/^\d+-[a-z0-9]+\.txt$/);
    expect(data.file.originalName).toBe('README.txt');
  });
});
