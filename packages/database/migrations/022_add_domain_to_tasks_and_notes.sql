-- Migration 022: Add domain column to tasks and notes
-- Makes project_id optional and adds direct domain reference

-- Add domain to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS domain TEXT;

-- Add domain to notes  
ALTER TABLE notes ADD COLUMN IF NOT EXISTS domain TEXT;

-- Backfill domain from projects table for existing data
UPDATE tasks t
SET domain = p.domain
FROM projects p
WHERE t.project_id = p.id AND t.domain IS NULL;

UPDATE notes n
SET domain = p.domain
FROM projects p
WHERE n.project_id = p.id AND n.domain IS NULL;

-- Delete orphaned notes/tasks with no project_id (no real users, safe to delete)
DELETE FROM tasks WHERE project_id IS NULL AND domain IS NULL;
DELETE FROM notes WHERE project_id IS NULL AND domain IS NULL;

-- Create domain enum type for validation
DO $$ BEGIN
  CREATE TYPE domain_type AS ENUM ('Body', 'Mind', 'Purpose', 'Connection', 'Growth', 'Finance');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Update tasks to use enum
ALTER TABLE tasks ALTER COLUMN domain TYPE domain_type USING domain::domain_type;
ALTER TABLE tasks ALTER COLUMN domain SET NOT NULL;

-- Update notes to use enum
ALTER TABLE notes ALTER COLUMN domain TYPE domain_type USING domain::domain_type;
ALTER TABLE notes ALTER COLUMN domain SET NOT NULL;

-- Make project_id nullable (for future custom projects)
ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE notes ALTER COLUMN project_id DROP NOT NULL;

-- Add comments
COMMENT ON COLUMN tasks.domain IS 'Wellness domain - one of: Body, Mind, Purpose, Connection, Growth, Finance';
COMMENT ON COLUMN notes.domain IS 'Wellness domain - one of: Body, Mind, Purpose, Connection, Growth, Finance';
