-- Add conversation summary fields
-- These enable progressive summarization: recent messages + AI-generated summary of older messages

ALTER TABLE conversations
ADD COLUMN conversation_summary TEXT,
ADD COLUMN message_count INTEGER DEFAULT 0,
ADD COLUMN last_summarized_at TIMESTAMPTZ;

-- Add comment to explain the summarization strategy
COMMENT ON COLUMN conversations.conversation_summary IS 'AI-generated summary of messages older than the last 50 messages';
COMMENT ON COLUMN conversations.message_count IS 'Total count of messages in this conversation';
COMMENT ON COLUMN conversations.last_summarized_at IS 'Timestamp when the conversation was last summarized';
