/**
 * API request/response types for Chatkin OS
 */

// AI Chat API
export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  files?: Array<{ name: string; url: string; type: string }>;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  files?: Array<{ name: string; url: string; type: string }>;
  conversationHistory?: ChatMessage[];
  conversationSummary?: string; // AI-generated summary of older messages
  workspaceContext?: string; // Formatted workspace context (projects, tasks, notes)
  context?: {
    projectId?: string;
    taskIds?: string[];
    scope?: 'global' | 'tasks' | 'notes' | 'project';
    domain?: 'Body' | 'Mind' | 'Purpose' | 'Connection' | 'Growth' | 'Finance';
  };
  authToken?: string; // User's auth token for database queries (RLS)
  mode?: 'chat' | 'action'; // Chat mode (Marvin persona, read-only) or Action mode (task-oriented, full CRUD)
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
  context?: Record<string, unknown>;
}

export interface GenerateResponse {
  structured: Record<string, unknown>;
  explanation: string;
}

// File Upload API
export interface UploadRequest {
  file: File;
  noteId?: string;
  conversationId?: string; // Link file to conversation
  messageId?: string; // Link file to specific message
  hideFromLibrary?: boolean; // If true, hide from Files library (keep in chat)
}

export interface UploadResponse {
  fileId: string;
  r2Url: string;
  r2Key: string;
  filename: string;
  sizeBytes: number;
  isHiddenFromLibrary: boolean; // Indicates if file is hidden from library
  title?: string; // AI-generated or user-edited title
  description?: string; // AI-generated or user-edited description
}

// Error Response
export interface ErrorResponse {
  error: string;
  message?: string;
  details?: Record<string, unknown>;
}
