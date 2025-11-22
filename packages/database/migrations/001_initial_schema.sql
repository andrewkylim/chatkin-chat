-- Chatkin OS Initial Schema
-- Based on docs/chatkin-os/DRAFT-NOTES.md

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note Blocks
CREATE TABLE note_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID REFERENCES notes ON DELETE CASCADE,
  type TEXT NOT NULL,
  content JSONB NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'global',
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Files
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  note_id UUID REFERENCES notes ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  r2_key TEXT NOT NULL,
  r2_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users access own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own notes" ON notes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own note blocks" ON note_blocks
  FOR ALL USING (
    note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
  );

CREATE POLICY "Users access own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own messages" ON messages
  FOR ALL USING (
    conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );

CREATE POLICY "Users access own files" ON files
  FOR ALL USING (auth.uid() = user_id);

-- Full-text search setup
ALTER TABLE tasks ADD COLUMN search_vector tsvector;
ALTER TABLE notes ADD COLUMN search_vector tsvector;

CREATE INDEX tasks_search_idx ON tasks USING GIN(search_vector);
CREATE INDEX notes_search_idx ON notes USING GIN(search_vector);

-- Trigger for updating task search vector
CREATE OR REPLACE FUNCTION update_task_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_search_update
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_search_vector();

-- Trigger for updating note search vector
CREATE OR REPLACE FUNCTION update_note_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_search_update
  BEFORE INSERT OR UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_note_search_vector();
