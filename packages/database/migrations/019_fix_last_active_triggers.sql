-- Migration 019: Fix Last Active Triggers
-- Fix the update_user_last_active function to work correctly with messages table
-- Messages table has conversation_id, not user_id directly

-- Drop existing function and recreate with proper logic
DROP FUNCTION IF EXISTS update_user_last_active() CASCADE;

-- Create separate functions for each table type
CREATE OR REPLACE FUNCTION update_user_last_active_from_messages()
RETURNS TRIGGER AS $$
BEGIN
  -- Messages table has conversation_id, need to join to get user_id
  UPDATE user_profiles
  SET last_active = NOW()
  WHERE user_id = (
    SELECT user_id FROM conversations WHERE id = NEW.conversation_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_last_active_from_user_table()
RETURNS TRIGGER AS $$
BEGIN
  -- Tasks and notes tables have user_id directly
  UPDATE user_profiles
  SET last_active = NOW()
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old triggers
DROP TRIGGER IF EXISTS messages_update_last_active ON messages;
DROP TRIGGER IF EXISTS tasks_update_last_active ON tasks;
DROP TRIGGER IF EXISTS notes_update_last_active ON notes;

-- Recreate triggers with correct functions
CREATE TRIGGER messages_update_last_active
  AFTER INSERT ON messages
  FOR EACH ROW
  WHEN (NEW.role = 'user')
  EXECUTE FUNCTION update_user_last_active_from_messages();

CREATE TRIGGER tasks_update_last_active
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_active_from_user_table();

CREATE TRIGGER notes_update_last_active
  AFTER INSERT OR UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_active_from_user_table();

-- Verification
SELECT 'Last active triggers fixed' AS status;

-- Show triggers
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%update_last_active%'
ORDER BY event_object_table;
