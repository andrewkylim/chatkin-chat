-- Add draft_tasks column to assessment_results
-- This stores AI-generated task suggestions before user commits to them

ALTER TABLE assessment_results
ADD COLUMN draft_tasks jsonb;

COMMENT ON COLUMN assessment_results.draft_tasks IS 'AI-generated draft tasks presented to user for co-creation in first chat session';
