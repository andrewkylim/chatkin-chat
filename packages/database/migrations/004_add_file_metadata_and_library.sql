-- Add file metadata and library control fields
-- Enables hiding files from library while keeping them in chat history
-- Adds AI-generated titles and descriptions for library files

-- Chat context linking
ALTER TABLE files ADD COLUMN conversation_id UUID REFERENCES conversations ON DELETE CASCADE;
ALTER TABLE files ADD COLUMN message_id UUID REFERENCES messages ON DELETE CASCADE;

-- Library visibility control (replaces ephemeral concept)
ALTER TABLE files ADD COLUMN is_hidden_from_library BOOLEAN DEFAULT FALSE NOT NULL;

-- AI-generated metadata for library files
ALTER TABLE files ADD COLUMN title VARCHAR(255);
ALTER TABLE files ADD COLUMN description TEXT;
ALTER TABLE files ADD COLUMN ai_generated_metadata BOOLEAN DEFAULT FALSE NOT NULL;

-- Indexes for efficient queries
CREATE INDEX idx_files_library_visible ON files(user_id, created_at DESC)
WHERE is_hidden_from_library = FALSE;

CREATE INDEX idx_files_conversation ON files(conversation_id)
WHERE conversation_id IS NOT NULL;

CREATE INDEX idx_files_message ON files(message_id)
WHERE message_id IS NOT NULL;

-- Comments explaining the columns
COMMENT ON COLUMN files.conversation_id IS 'Links file to the conversation it was uploaded in';
COMMENT ON COLUMN files.message_id IS 'Links file to the specific message it was uploaded with';
COMMENT ON COLUMN files.is_hidden_from_library IS 'If true, file is accessible in chat but hidden from Files library (default: false for backward compatibility)';
COMMENT ON COLUMN files.title IS 'AI-generated or user-edited title for the file';
COMMENT ON COLUMN files.description IS 'AI-generated or user-edited description of the file content';
COMMENT ON COLUMN files.ai_generated_metadata IS 'Indicates if title and description were AI-generated';
