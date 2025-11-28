-- Migration 005: Add project_id to files and fix CASCADE delete bugs
-- This migration:
-- 1. Fixes CASCADE delete bug where clearing chat history deletes files
-- 2. Adds project_id column to files table for file-to-project associations

-- FIX CASCADE BUG: Change conversation_id and message_id to SET NULL instead of CASCADE
-- This prevents files from being deleted when chat history is cleared
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_conversation_id_fkey;
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_message_id_fkey;

ALTER TABLE files
  ADD CONSTRAINT files_conversation_id_fkey
  FOREIGN KEY (conversation_id)
  REFERENCES conversations(id)
  ON DELETE SET NULL;

ALTER TABLE files
  ADD CONSTRAINT files_message_id_fkey
  FOREIGN KEY (message_id)
  REFERENCES messages(id)
  ON DELETE SET NULL;

-- Add project_id to files table
ALTER TABLE files ADD COLUMN project_id UUID REFERENCES projects ON DELETE SET NULL;

-- Create index for efficient project file queries
CREATE INDEX idx_files_project ON files(project_id) WHERE project_id IS NOT NULL;

-- Comments explaining the columns
COMMENT ON COLUMN files.project_id IS 'Links file to a project (NULL = standalone file)';
COMMENT ON COLUMN files.conversation_id IS 'Links file to conversation (SET NULL on delete, not CASCADE)';
COMMENT ON COLUMN files.message_id IS 'Links file to message (SET NULL on delete, not CASCADE)';
