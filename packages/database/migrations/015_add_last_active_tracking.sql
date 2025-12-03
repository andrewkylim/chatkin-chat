-- Migration 015: Add Last Active Tracking
-- Track user activity for notification strategy (3-tier: reminders/observations/check-ins)

-- Add last_active field to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW();

-- Add index for notification queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active ON user_profiles(last_active);

-- Add comment
COMMENT ON COLUMN user_profiles.last_active IS 'Last time user interacted with the system. Used for notification strategy: task reminders (always), high-priority observations (inactive 3+ days), check-ins (inactive 7+ days)';

-- Create function to update last_active
CREATE OR REPLACE FUNCTION update_user_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET last_active = NOW()
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger on messages table to auto-update last_active
DROP TRIGGER IF EXISTS messages_update_last_active ON messages;

CREATE TRIGGER messages_update_last_active
  AFTER INSERT ON messages
  FOR EACH ROW
  WHEN (NEW.role = 'user')
  EXECUTE FUNCTION update_user_last_active();

-- Add trigger on tasks table to auto-update last_active
DROP TRIGGER IF EXISTS tasks_update_last_active ON tasks;

CREATE TRIGGER tasks_update_last_active
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_active();

-- Add trigger on notes table to auto-update last_active
DROP TRIGGER IF EXISTS notes_update_last_active ON notes;

CREATE TRIGGER notes_update_last_active
  AFTER INSERT OR UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_active();

-- Verification
SELECT 'Last active tracking enabled' AS status;

-- Show triggers created
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%update_last_active%';

-- Show user profiles with last_active
SELECT user_id, last_active, has_completed_questionnaire
FROM user_profiles
LIMIT 5;
