-- Add domain column to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS domain domain_type;

-- Backfill domain from projects table for existing conversations
UPDATE conversations c
SET domain = p.domain::domain_type
FROM projects p
WHERE c.project_id = p.id AND c.domain IS NULL;

-- For conversations with scope='project' but still no domain, delete them (orphaned)
DELETE FROM conversations WHERE scope = 'project' AND domain IS NULL;

-- For conversations with scope='global' and no domain, set to a default (e.g., 'Mind')
UPDATE conversations SET domain = 'Mind' WHERE scope = 'global' AND domain IS NULL;

-- Delete any remaining conversations without a domain (edge cases)
DELETE FROM conversations WHERE domain IS NULL;

-- Make domain NOT NULL
ALTER TABLE conversations ALTER COLUMN domain SET NOT NULL;

-- Make project_id nullable (it already is, but being explicit)
ALTER TABLE conversations ALTER COLUMN project_id DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN conversations.domain IS 'Wellness domain - one of: Body, Mind, Purpose, Connection, Growth, Finance';
