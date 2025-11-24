-- Auto-increment message_count on conversations table
-- This trigger ensures message_count stays in sync with actual message records

-- Function to increment message_count when a message is inserted
CREATE OR REPLACE FUNCTION increment_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET message_count = message_count + 1,
      updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement message_count when a message is deleted
CREATE OR REPLACE FUNCTION decrement_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET message_count = message_count - 1,
      updated_at = NOW()
  WHERE id = OLD.conversation_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger for incrementing on INSERT
CREATE TRIGGER message_insert_increment_count
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_conversation_message_count();

-- Trigger for decrementing on DELETE
CREATE TRIGGER message_delete_decrement_count
  AFTER DELETE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION decrement_conversation_message_count();
