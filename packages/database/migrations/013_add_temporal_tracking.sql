-- Migration 013: Add Temporal Tracking for Pattern Detection
-- Enables AI to detect stuck tasks, domain trends, and behavioral patterns

-- ============================================================================
-- PART 1: Add Timestamp Fields to Tasks
-- ============================================================================

-- Add started_at to track when task moved to in_progress
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Note: created_at, completed_at, updated_at already exist in schema

-- Add index for temporal queries
CREATE INDEX IF NOT EXISTS idx_tasks_started_at ON tasks(started_at) WHERE started_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

-- Add comments
COMMENT ON COLUMN tasks.started_at IS 'Timestamp when task first moved to in_progress status';

-- ============================================================================
-- PART 2: Create Auto-Update Trigger for Timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_task_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set started_at when task first moves to in_progress
  IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress') AND NEW.started_at IS NULL THEN
    NEW.started_at = NOW();
  END IF;

  -- Set completed_at when task moves to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') AND NEW.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  END IF;

  -- Always update updated_at
  NEW.updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS task_timestamps_trigger ON tasks;

CREATE TRIGGER task_timestamps_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_timestamps();

-- ============================================================================
-- PART 3: Create Helper Function for Days In Progress
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_days_in_progress(task_started_at TIMESTAMPTZ)
RETURNS INTEGER AS $$
BEGIN
  IF task_started_at IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN EXTRACT(DAY FROM NOW() - task_started_at)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_days_in_progress IS 'Calculate how many days a task has been in progress';

-- ============================================================================
-- PART 4: Create Domain Trends View
-- ============================================================================

CREATE OR REPLACE VIEW domain_trends AS
SELECT
  t.user_id,
  p.domain,
  COUNT(*) FILTER (WHERE t.completed_at >= NOW() - INTERVAL '7 days') AS tasks_completed_last_7_days,
  COUNT(*) FILTER (WHERE t.completed_at >= NOW() - INTERVAL '30 days') AS tasks_completed_last_30_days,
  COUNT(*) FILTER (WHERE t.status = 'completed' AND t.completed_at IS NOT NULL) AS total_completed,
  COUNT(*) FILTER (WHERE t.status = 'todo') AS tasks_todo,
  COUNT(*) FILTER (WHERE t.status = 'in_progress') AS tasks_in_progress,
  AVG(EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 86400)
    FILTER (WHERE t.completed_at IS NOT NULL AND t.status = 'completed') AS avg_completion_time_days,
  COUNT(*) FILTER (
    WHERE t.status = 'todo'
    AND t.created_at < NOW() - INTERVAL '30 days'
  ) AS abandoned_task_count,
  COUNT(*) FILTER (
    WHERE t.status = 'in_progress'
    AND t.started_at IS NOT NULL
    AND t.started_at < NOW() - INTERVAL '7 days'
  ) AS stuck_task_count
FROM tasks t
JOIN projects p ON t.project_id = p.id
WHERE p.domain IS NOT NULL
GROUP BY t.user_id, p.domain;

COMMENT ON VIEW domain_trends IS 'Aggregated metrics per user per domain for pattern detection. Used by AI to identify stuck tasks, abandoned domains, and progress trends.';

-- ============================================================================
-- PART 5: Create Recurring Task Adherence View
-- ============================================================================

CREATE OR REPLACE VIEW recurring_task_adherence AS
SELECT
  t.user_id,
  p.domain,
  t.parent_task_id,
  parent.title as recurring_task_title,
  COUNT(*) FILTER (WHERE t.status = 'completed') AS times_completed,
  COUNT(*) FILTER (WHERE t.status = 'completed' AND t.completed_at >= NOW() - INTERVAL '7 days') AS completed_last_7_days,
  COUNT(*) FILTER (WHERE t.status = 'completed' AND t.completed_at >= NOW() - INTERVAL '30 days') AS completed_last_30_days,
  COUNT(*) FILTER (WHERE t.status != 'completed') AS times_skipped,
  MAX(t.completed_at) as last_completed_at,
  EXTRACT(DAY FROM NOW() - MAX(t.completed_at))::INTEGER as days_since_last_completion
FROM tasks t
JOIN projects p ON t.project_id = p.id
LEFT JOIN tasks parent ON t.parent_task_id = parent.id
WHERE t.parent_task_id IS NOT NULL
  AND p.domain IS NOT NULL
GROUP BY t.user_id, p.domain, t.parent_task_id, parent.title;

COMMENT ON VIEW recurring_task_adherence IS 'Track adherence to recurring tasks. Used by AI to identify failing routines and celebrate consistency.';

-- ============================================================================
-- PART 6: Add Index for User + Status Queries (Performance)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 'Temporal tracking setup complete' AS status;

-- Show new columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND column_name IN ('started_at', 'created_at', 'completed_at', 'updated_at')
ORDER BY column_name;

-- Show views created
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('domain_trends', 'recurring_task_adherence');

-- Test domain_trends view (will be empty if no tasks exist)
SELECT 'Domain trends view test:' as info;
SELECT * FROM domain_trends LIMIT 5;

-- Test recurring_task_adherence view
SELECT 'Recurring adherence view test:' as info;
SELECT * FROM recurring_task_adherence LIMIT 5;
