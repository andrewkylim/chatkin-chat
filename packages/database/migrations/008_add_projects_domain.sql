-- Add domain field to projects table
-- This allows projects to be categorized by wellness domain (Body, Mind, Purpose, Connection, Growth, Finance)

ALTER TABLE projects ADD COLUMN domain TEXT;

-- Add check constraint to ensure valid domain values
ALTER TABLE projects ADD CONSTRAINT projects_domain_check
  CHECK (domain IS NULL OR domain IN ('Body', 'Mind', 'Purpose', 'Connection', 'Growth', 'Finance'));

-- Add index for domain lookups (performance optimization)
CREATE INDEX idx_projects_domain ON projects(domain);

-- Add comment for documentation
COMMENT ON COLUMN projects.domain IS 'Wellness domain category: Body, Mind, Purpose, Connection, Growth, Finance, or NULL for unassigned';
