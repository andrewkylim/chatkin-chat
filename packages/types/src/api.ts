/**
 * API request/response types for Chatkin OS
 */

// AI Chat API
export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  conversationHistory?: ChatMessage[];
  conversationSummary?: string; // AI-generated summary of older messages
  workspaceContext?: string; // Formatted workspace context (projects, tasks, notes)
  context?: {
    projectId?: string;
    taskIds?: string[];
    scope?: 'global' | 'tasks' | 'notes' | 'project';
  };
}

export interface ChatResponse {
  response: string;
  conversationId: string;
  messageId: string;
}

// AI Generation API
export interface GenerateRequest {
  type: 'project' | 'tasks' | 'notes';
  prompt: string;
  context?: Record<string, any>;
}

export interface GenerateResponse {
  structured: Record<string, any>;
  explanation: string;
}

// File Upload API
export interface UploadRequest {
  file: File;
  noteId?: string;
}

export interface UploadResponse {
  fileId: string;
  r2Url: string;
  r2Key: string;
  filename: string;
  sizeBytes: number;
}

// Error Response
export interface ErrorResponse {
  error: string;
  message?: string;
  details?: Record<string, any>;
}
