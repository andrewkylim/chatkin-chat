/**
 * Database types for Chatkin OS
 * Based on the schema defined in docs/chatkin-os/DRAFT-NOTES.md
 */

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string | null; // NULL = standalone task
  user_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null; // ISO date string
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  project_id: string | null; // NULL = standalone note
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteBlock {
  id: string;
  note_id: string;
  type: 'text' | 'table' | 'file' | 'code';
  content: Record<string, any>; // JSONB
  position: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  project_id: string | null; // NULL = not project-scoped
  scope: 'global' | 'project' | 'tasks' | 'notes';
  title: string | null;
  conversation_summary: string | null; // AI-generated summary of older messages
  message_count: number;
  last_summarized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, any> | null; // JSONB - tool calls, structured outputs
  created_at: string;
}

export interface File {
  id: string;
  user_id: string;
  note_id: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  r2_key: string; // Path in R2 bucket
  r2_url: string; // Public URL or signed URL
  created_at: string;
}

// Supabase Auth User type (simplified)
export interface User {
  id: string;
  email: string | null;
  created_at: string;
}
