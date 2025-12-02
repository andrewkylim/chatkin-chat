-- Migration 009: Convert to Fixed Domain Projects Architecture
-- This migration transforms the flexible project system into 6 fixed domain projects per user

-- Step 0: Drop constraint and trigger if they exist (in case of partial migration)
DO $$
BEGIN
  -- Drop constraint if exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_domain') THEN
    ALTER TABLE projects DROP CONSTRAINT unique_user_domain;
    RAISE NOTICE 'Dropped existing unique_user_domain constraint';
  END IF;

  -- Drop trigger if exists
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'seed_projects_on_signup') THEN
    DROP TRIGGER seed_projects_on_signup ON auth.users;
    RAISE NOTICE 'Dropped existing seed_projects_on_signup trigger';
  END IF;

  -- Drop function if exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'seed_user_projects') THEN
    DROP FUNCTION seed_user_projects();
    RAISE NOTICE 'Dropped existing seed_user_projects function';
  END IF;
END $$;

-- Step 1: Clean up any duplicate domain projects
-- Delete ALL domain projects first, then we'll recreate them properly
DO $$
DECLARE
  total_projects INTEGER;
  body_projects INTEGER;
BEGIN
  -- Count total projects before
  SELECT COUNT(*) INTO total_projects FROM projects WHERE domain IS NOT NULL;
  RAISE NOTICE 'Total projects with domains before cleanup: %', total_projects;

  -- Count Body projects specifically
  SELECT COUNT(*) INTO body_projects FROM projects WHERE domain = 'Body';
  RAISE NOTICE 'Body domain projects: %', body_projects;

  -- Delete ALL projects with domains (we'll recreate 6 per user in Step 6)
  DELETE FROM projects WHERE domain IS NOT NULL;

  SELECT COUNT(*) INTO total_projects FROM projects;
  RAISE NOTICE 'Total projects remaining after cleanup: %', total_projects;
END $$;

-- Step 2: Create function to seed 6 domain projects for new users (do this BEFORE seeding)
CREATE OR REPLACE FUNCTION seed_user_projects()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert 6 fixed domain projects for the new user
  INSERT INTO projects (user_id, name, domain, description, color)
  VALUES
    (NEW.id, 'Body', 'Body', 'Physical health, fitness & energy', '💪'),
    (NEW.id, 'Mind', 'Mind', 'Mental & emotional wellbeing', '🧠'),
    (NEW.id, 'Purpose', 'Purpose', 'Work, meaning & fulfillment', '🎯'),
    (NEW.id, 'Connection', 'Connection', 'Relationships & community', '🤝'),
    (NEW.id, 'Growth', 'Growth', 'Learning & development', '🌱'),
    (NEW.id, 'Finance', 'Finance', 'Financial & resource stability', '💰');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Seed projects for any existing users who don't have the full set
-- This ensures existing test users get all 6 domain projects
DO $$
DECLARE
  rows_inserted INTEGER;
BEGIN
  INSERT INTO projects (user_id, name, domain, description, color)
  SELECT
    u.id,
    d.domain,
    d.domain,
    d.description,
    d.emoji
  FROM auth.users u
  CROSS JOIN (
    VALUES
      ('Body', 'Physical health, fitness & energy', '💪'),
      ('Mind', 'Mental & emotional wellbeing', '🧠'),
      ('Purpose', 'Work, meaning & fulfillment', '🎯'),
      ('Connection', 'Relationships & community', '🤝'),
      ('Growth', 'Learning & development', '🌱'),
      ('Finance', 'Financial & resource stability', '💰')
  ) AS d(domain, description, emoji)
  WHERE NOT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.user_id = u.id AND p.domain = d.domain
  );

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;
  RAISE NOTICE 'Step 3: Inserted % projects', rows_inserted;

  -- Immediately check what we have
  RAISE NOTICE 'Step 3: Projects now in database:';
  FOR rows_inserted IN
    SELECT user_id, domain, COUNT(*) as cnt, array_agg(id) as ids
    FROM projects
    WHERE domain IS NOT NULL
    GROUP BY user_id, domain
    ORDER BY user_id, domain
  LOOP
    RAISE NOTICE '  user=%, domain=%, count=%, ids=%',
      (SELECT user_id FROM projects WHERE id = (SELECT unnest(rows_inserted.ids) LIMIT 1)),
      (SELECT domain FROM projects WHERE id = (SELECT unnest(rows_inserted.ids) LIMIT 1)),
      rows_inserted.cnt,
      rows_inserted.ids;
  END LOOP;
END $$;

-- Step 4: Make domain NOT NULL (currently nullable)
-- First, set any existing NULL domains to a default (shouldn't be any with fresh DB)
UPDATE projects SET domain = 'Body' WHERE domain IS NULL;

-- Then make the column NOT NULL
ALTER TABLE projects ALTER COLUMN domain SET NOT NULL;

-- Step 4.5: Verify no duplicates exist before adding constraint
DO $$
DECLARE
  dup_record RECORD;
  dup_count INTEGER;
BEGIN
  -- Check for duplicates
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT user_id, domain, COUNT(*) as cnt
    FROM projects
    WHERE domain IS NOT NULL
    GROUP BY user_id, domain
    HAVING COUNT(*) > 1
  ) dups;

  RAISE NOTICE 'Found % duplicate (user_id, domain) pairs', dup_count;

  -- List all duplicates
  FOR dup_record IN
    SELECT user_id, domain, COUNT(*) as cnt
    FROM projects
    WHERE domain IS NOT NULL
    GROUP BY user_id, domain
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Duplicate: user_id=%, domain=%, count=%', dup_record.user_id, dup_record.domain, dup_record.cnt;

    -- Show the actual project IDs
    FOR dup_record IN
      SELECT id, created_at
      FROM projects
      WHERE user_id = dup_record.user_id AND domain = dup_record.domain
      ORDER BY created_at
    LOOP
      RAISE NOTICE '  Project ID: %, created_at: %', dup_record.id, dup_record.created_at;
    END LOOP;
  END LOOP;

  -- If duplicates exist, abort
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot add unique constraint - duplicates exist!';
  END IF;
END $$;

-- Step 5: Add unique constraint - each user can only have one project per domain
ALTER TABLE projects ADD CONSTRAINT unique_user_domain UNIQUE (user_id, domain);

-- Step 6: Attach trigger to user signup
-- Note: In Supabase, the auth.users table is managed by Supabase Auth
-- We'll create the trigger on auth.users for automatic seeding
CREATE TRIGGER seed_projects_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION seed_user_projects();

-- Step 7: Add comment explaining the new architecture
COMMENT ON COLUMN projects.domain IS 'Wellness domain - NOT NULL, unique per user. Each user has exactly 6 fixed domain projects.';
COMMENT ON CONSTRAINT unique_user_domain ON projects IS 'Ensures each user has exactly one project per domain (6 total).';
