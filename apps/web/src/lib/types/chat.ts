/**
 * Chat-related type definitions
 */

export type MessageRole = 'user' | 'ai';

export type OperationType = 'create' | 'update' | 'delete';

export type ItemType = 'task' | 'note' | 'project';

export type Priority = 'low' | 'medium' | 'high';

export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface FileAttachment {
  name: string;
  originalName?: string;
  url: string;
  type: string;
  size: number;
}

export interface AIQuestion {
  question: string;
  options: string[];
}

export interface TaskData {
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  due_date?: string | null;
  project_id?: string | null;
}

export interface NoteData {
  title: string;
  content?: string;
  project_id?: string | null;
}

export interface ProjectData {
  name: string;
  description?: string;
  color?: string;
}

export type OperationData = TaskData | NoteData | ProjectData;

export interface Operation {
  operation: OperationType;
  type: ItemType;
  id?: string;
  data?: OperationData;
  changes?: Partial<OperationData>;
  reason?: string;
  selected?: boolean;
}

export interface Message {
  role: MessageRole;
  content: string;
  files?: FileAttachment[];
  operations?: Operation[];
  selectedOperations?: Operation[];
  questions?: AIQuestion[];
  userResponse?: Record<string, string>;
  summary?: string;
  isTyping?: boolean;
  awaitingResponse?: boolean;
}

export interface ConversationMessage {
  role: MessageRole;
  content: string;
}

export interface ChatResponse {
  type: 'message' | 'actions' | 'questions';
  message?: string;
  summary?: string;
  actions?: Operation[];
  questions?: AIQuestion[];
}
