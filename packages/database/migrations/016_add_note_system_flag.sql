-- Migration 016: Add System-Generated Note Flag
-- Distinguish AI-generated domain primer notes from user-created notes

ALTER TABLE notes
ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN DEFAULT FALSE;

-- Add index for filtering system notes
CREATE INDEX IF NOT EXISTS idx_notes_system_generated ON notes(is_system_generated) WHERE is_system_generated = TRUE;

-- Add comment
COMMENT ON COLUMN notes.is_system_generated IS 'TRUE for AI-generated domain primer notes created during onboarding. FALSE for user-created notes.';

-- Verification
SELECT 'Note system flag added' AS status;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'notes'
  AND column_name = 'is_system_generated';
