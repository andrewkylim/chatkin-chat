-- Add domain column to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS domain domain_type;

-- Backfill domain from projects table for existing files
UPDATE files f
SET domain = p.domain::domain_type
FROM projects p
WHERE f.project_id = p.id AND f.domain IS NULL;

-- Delete orphaned files with no project_id (shouldn't exist, but clean up if any)
DELETE FROM files WHERE project_id IS NULL AND domain IS NULL;

-- Make domain NOT NULL
ALTER TABLE files ALTER COLUMN domain SET NOT NULL;

-- Make project_id nullable
ALTER TABLE files ALTER COLUMN project_id DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN files.domain IS 'Wellness domain - one of: Body, Mind, Purpose, Connection, Growth, Finance';
