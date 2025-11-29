-- User notification preferences table
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email notification toggles
  email_task_due_soon BOOLEAN NOT NULL DEFAULT true,
  email_ai_proposals BOOLEAN NOT NULL DEFAULT true,
  email_ai_insights BOOLEAN NOT NULL DEFAULT true,

  -- Browser notification toggles (independent from email)
  browser_task_due_soon BOOLEAN NOT NULL DEFAULT true,
  browser_ai_proposals BOOLEAN NOT NULL DEFAULT true,
  browser_ai_insights BOOLEAN NOT NULL DEFAULT true,

  -- Email address (defaults to user's auth email but can be customized)
  notification_email TEXT,

  -- Reminder timing preferences
  task_reminder_hours_before INTEGER NOT NULL DEFAULT 24,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one preference row per user
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notification preferences"
  ON user_notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON user_notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON user_notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_notification_prefs_user_id ON user_notification_preferences(user_id);

-- Notification queue/history table
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,

  -- Related entity
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,

  -- Notification content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,

  -- Delivery status
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own notifications)
CREATE POLICY "Users can view their own notifications"
  ON notification_queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes for efficient queries
CREATE INDEX idx_notification_queue_user_id ON notification_queue(user_id);
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_created_at ON notification_queue(created_at);
CREATE INDEX idx_notification_queue_task_id ON notification_queue(task_id) WHERE task_id IS NOT NULL;
