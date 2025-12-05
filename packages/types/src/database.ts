/**
 * Database types for Chatkin OS
 * Based on the schema defined in docs/chatkin-os/DRAFT-NOTES.md
 */

export type WellnessDomain = 'Body' | 'Mind' | 'Purpose' | 'Connection' | 'Growth' | 'Finance';

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // e.g., 2 for "every 2 weeks"
  days_of_week?: number[]; // [0-6] for weekly (0=Sunday, 6=Saturday)
  day_of_month?: number; // 1-31 for monthly
  month_of_year?: number; // 1-12 for yearly
  custom_rule?: string; // For complex patterns
}

export interface Task {
  id: string;
  domain: WellnessDomain; // Wellness domain (Body, Mind, Purpose, Connection, Growth, Finance) - single source of truth for categorization
  user_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null; // ISO date string (YYYY-MM-DD)
  due_time: string | null; // Time string (HH:MM:SS) - null for all-day tasks
  is_all_day: boolean; // Whether task is all-day (no specific time)
  completed_at: string | null;
  is_recurring: boolean; // Whether this task repeats
  recurrence_pattern: RecurrencePattern | null; // Recurrence configuration
  parent_task_id: string | null; // For instances of recurring tasks
  recurrence_end_date: string | null; // When to stop repeating
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  domain: WellnessDomain; // Wellness domain (Body, Mind, Purpose, Connection, Growth, Finance) - single source of truth for categorization
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteBlock {
  id: string;
  note_id: string;
  type: 'text' | 'table' | 'file' | 'code';
  content: Record<string, unknown>; // JSONB
  position: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  domain: WellnessDomain; // Wellness domain (Body, Mind, Purpose, Connection, Growth, Finance) - single source of truth for categorization
  scope: 'global' | 'project' | 'tasks' | 'notes';
  title: string | null;
  mode: 'chat' | 'action'; // Chat mode (Marvin persona, read-only) or Action mode (task-oriented, full CRUD)
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
  metadata: Record<string, unknown> | null; // JSONB - tool calls, structured outputs
  created_at: string;
}

export interface File {
  id: string;
  user_id: string;
  note_id: string | null;
  conversation_id: string | null; // Link to chat conversation
  message_id: string | null; // Link to specific message
  domain: WellnessDomain; // Wellness domain (Body, Mind, Purpose, Connection, Growth, Finance) - single source of truth for categorization
  filename: string;
  mime_type: string;
  size_bytes: number;
  r2_key: string; // Path in R2 bucket
  r2_url: string; // Public URL or signed URL
  is_hidden_from_library: boolean; // Hide from library, keep in chat
  title: string | null; // AI-generated or user-edited title
  description: string | null; // AI-generated or user-edited description
  ai_generated_metadata: boolean; // Track if AI generated title/desc
  created_at: string;
}

// Supabase Auth User type (simplified)
export interface User {
  id: string;
  email: string | null;
  created_at: string;
}

export interface UserNotificationPreferences {
  id: string;
  user_id: string;
  email_task_due_soon: boolean;
  email_ai_proposals: boolean;
  email_ai_insights: boolean;
  browser_task_due_soon: boolean;
  browser_ai_proposals: boolean;
  browser_ai_insights: boolean;
  notification_email: string | null;
  task_reminder_times: number[]; // Array of hours before due time (e.g., [1, 24, 168])
  created_at: string;
  updated_at: string;
}

export interface NotificationQueue {
  id: string;
  user_id: string;
  notification_type: 'task_due_soon' | 'ai_proposal' | 'ai_insight';
  channel: 'email' | 'browser';
  task_id: string | null;
  message_id: string | null;
  title: string;
  body: string;
  action_url: string | null;
  status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}
