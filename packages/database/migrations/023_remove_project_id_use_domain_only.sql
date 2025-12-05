-- Migration 023: Remove project_id columns and projects table
-- Simplifies architecture to use domain as single source of truth
-- Projects table only contained 6 fixed domain projects, which is redundant with domain field

-- Step 1: Drop views that depend on project_id columns
DROP VIEW IF EXISTS domain_trends CASCADE;
DROP VIEW IF EXISTS recurring_task_adherence CASCADE;

-- Step 2: Drop foreign key constraints
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_project_id_fkey;
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_project_id_fkey;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_project_id_fkey;

-- Step 3: Drop project_id columns from all tables
ALTER TABLE tasks DROP COLUMN IF EXISTS project_id;
ALTER TABLE notes DROP COLUMN IF EXISTS project_id;
ALTER TABLE files DROP COLUMN IF EXISTS project_id;
ALTER TABLE conversations DROP COLUMN IF EXISTS project_id;

-- Step 3: Drop the seed_projects_on_signup trigger (no longer needed)
DROP TRIGGER IF EXISTS seed_projects_on_signup ON auth.users;

-- Step 4: Drop the seed_user_projects function (no longer needed)
DROP FUNCTION IF EXISTS seed_user_projects();

-- Step 5: Drop the projects table entirely
DROP TABLE IF EXISTS projects CASCADE;

-- Step 6: Add comments explaining the simplified architecture
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'domain') THEN
    COMMENT ON COLUMN tasks.domain IS 'Wellness domain - one of: Body, Mind, Purpose, Connection, Growth, Finance. This is the single source of truth for categorization.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'domain') THEN
    COMMENT ON COLUMN notes.domain IS 'Wellness domain - one of: Body, Mind, Purpose, Connection, Growth, Finance. This is the single source of truth for categorization.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'domain') THEN
    COMMENT ON COLUMN files.domain IS 'Wellness domain - one of: Body, Mind, Purpose, Connection, Growth, Finance. This is the single source of truth for categorization.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'domain') THEN
    COMMENT ON COLUMN conversations.domain IS 'Wellness domain - one of: Body, Mind, Purpose, Connection, Growth, Finance. This is the single source of truth for categorization.';
  END IF;
END $$;
