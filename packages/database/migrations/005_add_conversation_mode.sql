-- Add mode column to conversations table
-- This allows users to choose between chat mode (Marvin persona, read-only) 
-- and action mode (task-oriented, full CRUD operations)

ALTER TABLE conversations 
ADD COLUMN mode TEXT NOT NULL DEFAULT 'chat' 
CHECK (mode IN ('chat', 'action'));

-- Add index for faster queries
CREATE INDEX idx_conversations_mode ON conversations(mode);

-- Update existing conversations to have default mode
UPDATE conversations SET mode = 'chat' WHERE mode IS NULL;
