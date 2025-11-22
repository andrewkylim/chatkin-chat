/**
 * API request/response types for Chatkin OS
 */

// AI Chat API
export interface ChatRequest {
  conversation_id?: string;
  message: string;
  context?: {
    project_id?: string;
    task_ids?: string[];
    note_ids?: string[];
  };
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  message_id: string;
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
  note_id?: string;
}

export interface UploadResponse {
  file_id: string;
  r2_url: string;
  r2_key: string;
  filename: string;
  size_bytes: number;
}

// Error Response
export interface ErrorResponse {
  error: string;
  message?: string;
  details?: Record<string, any>;
}
