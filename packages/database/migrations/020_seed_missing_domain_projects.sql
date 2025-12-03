-- Migration 020: Seed Domain Projects for Existing Users
-- Create 6 domain projects for any users who don't have them yet
-- (Users who signed up before migration 009 won't have domain projects)

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

-- Verification
SELECT 'Domain projects seeded for existing users' AS status;

-- Show count of projects per user
SELECT
  u.id as user_id,
  u.email,
  COUNT(p.id) as project_count
FROM auth.users u
LEFT JOIN projects p ON p.user_id = u.id
GROUP BY u.id, u.email
ORDER BY project_count;

-- Show all domain projects
SELECT user_id, domain, name
FROM projects
WHERE domain IS NOT NULL
ORDER BY user_id, domain;
