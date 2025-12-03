-- Migration 011: Add Profile Fields for Exploration Questions
-- Store AI-generated exploration questions in user profile for contextual coaching

-- Add exploration_questions field to store 0-6 conversation starters
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS exploration_questions JSONB DEFAULT '[]'::jsonb;

-- Add index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_exploration_questions
ON user_profiles USING GIN (exploration_questions);

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.exploration_questions IS 'Array of 0-6 contextual exploration questions generated during onboarding. AI uses these during coaching conversations. Example: ["What kind of movement actually feels good to you?", "What are you avoiding right now?"]';

-- Verification
SELECT 'Profile fields added' AS status;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name = 'exploration_questions';
