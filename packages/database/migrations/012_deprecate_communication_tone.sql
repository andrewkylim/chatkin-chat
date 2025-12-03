-- Migration 012: Deprecate Auto-Determined Communication Tone
-- Remove the communication_tone field as AI should dynamically adjust tone, not use pre-set categories

-- Drop the communication_tone column
-- Note: Keeping it for now but marking as deprecated in case we want to migrate data
-- ALTER TABLE user_profiles DROP COLUMN IF EXISTS communication_tone;

-- For now, just add a comment marking it as deprecated
COMMENT ON COLUMN user_profiles.communication_tone IS 'DEPRECATED: Auto-determined tone categories are being removed. AI now dynamically adjusts tone based on context, user responses, and conversation state rather than using pre-set supportive/encouraging/motivational labels.';

-- Verification
SELECT 'Communication tone deprecated' AS status;
SELECT column_name, col_description('user_profiles'::regclass, ordinal_position) as description
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name = 'communication_tone';
