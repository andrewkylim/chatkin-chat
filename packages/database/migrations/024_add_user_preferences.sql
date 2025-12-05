-- Add user preferences columns to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS ai_tone TEXT CHECK (ai_tone IN ('challenging', 'supportive', 'balanced')) DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS proactivity_level TEXT CHECK (proactivity_level IN ('high', 'medium', 'low')) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS communication_style TEXT CHECK (communication_style IN ('brief', 'detailed', 'conversational')) DEFAULT 'conversational';

-- Add comment explaining the preferences
COMMENT ON COLUMN user_profiles.ai_tone IS 'User preference for AI coaching style: challenging (direct/tough love), supportive (encouraging/gentle), or balanced (adaptive)';
COMMENT ON COLUMN user_profiles.proactivity_level IS 'How proactive the AI should be: high (suggest frequently), medium (balanced), low (only when asked)';
COMMENT ON COLUMN user_profiles.communication_style IS 'Preferred communication style: brief (short responses), detailed (thorough explanations), conversational (natural dialogue)';
