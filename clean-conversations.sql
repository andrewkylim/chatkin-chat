-- Clean all conversations and messages for the current user
-- Run this in the Supabase SQL Editor

-- First, delete all messages for your conversations
DELETE FROM messages
WHERE conversation_id IN (
  SELECT id FROM conversations
  WHERE user_id = auth.uid()
);

-- Then, delete all conversations
DELETE FROM conversations
WHERE user_id = auth.uid();

-- Verify cleanup
SELECT
  (SELECT COUNT(*) FROM conversations WHERE user_id = auth.uid()) as remaining_conversations,
  (SELECT COUNT(*) FROM messages WHERE conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  )) as remaining_messages;
