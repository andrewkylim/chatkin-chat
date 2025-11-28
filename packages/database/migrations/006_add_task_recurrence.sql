-- Migration: Add task recurrence support
-- This allows tasks to repeat on a schedule (daily, weekly, monthly, yearly)

-- Add recurrence fields to tasks table
ALTER TABLE tasks
  ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE,
  ADD COLUMN recurrence_pattern JSONB,
  ADD COLUMN parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  ADD COLUMN recurrence_end_date DATE;

-- Add index for parent_task_id for faster lookups of task series
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

-- Add index for is_recurring to efficiently query recurring tasks
CREATE INDEX idx_tasks_is_recurring ON tasks(is_recurring) WHERE is_recurring = true;

-- Add comments for documentation
COMMENT ON COLUMN tasks.is_recurring IS 'Whether this task repeats on a schedule';
COMMENT ON COLUMN tasks.recurrence_pattern IS 'JSON object defining recurrence: {frequency, interval, days_of_week, day_of_month}';
COMMENT ON COLUMN tasks.parent_task_id IS 'For recurring task instances, references the original/parent task';
COMMENT ON COLUMN tasks.recurrence_end_date IS 'Optional end date for recurring tasks';
