-- Migration: Rename Security domain to Finance
-- This updates all references from 'Security' to 'Finance'

-- Update assessment_questions table
UPDATE assessment_questions
SET domain = 'Finance'
WHERE domain = 'Security';

-- Update projects table
UPDATE projects
SET domain = 'Finance'
WHERE domain = 'Security';

-- Update domain_scores in assessment_results
-- This updates the JSONB column to rename the key
UPDATE assessment_results
SET domain_scores = domain_scores - 'Security' || jsonb_build_object('Finance', domain_scores->'Security')
WHERE domain_scores ? 'Security';
