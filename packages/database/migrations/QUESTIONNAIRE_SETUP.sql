-- ============================================================================
-- CHATKIN OS - QUESTIONNAIRE SYSTEM SETUP
-- ============================================================================
-- Run this entire file in your Supabase SQL editor
-- This creates all tables, RLS policies, and seeds the 35 assessment questions
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE TABLES
-- ============================================================================

-- Assessment Questions Table (question bank)
CREATE TABLE IF NOT EXISTS assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL, -- 'Body', 'Mind', 'Purpose', 'Connection', 'Growth', 'Finance'
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('scale', 'emoji_scale', 'multiple_choice', 'open_ended')),
  options JSONB, -- For multiple_choice: [{"value": "...", "label": "...", "score": X}, ...]
  scale_min INTEGER, -- For scale/emoji_scale questions
  scale_max INTEGER,
  scale_min_label TEXT,
  scale_max_label TEXT,
  weight DECIMAL(3, 2) DEFAULT 1.0, -- Scoring weight (0.8 to 1.3)
  position INTEGER NOT NULL, -- Sort order (1-35)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assessment Responses Table (user answers)
CREATE TABLE IF NOT EXISTS assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES assessment_questions(id) ON DELETE CASCADE NOT NULL,
  response_value TEXT, -- For scale/emoji/choice: the selected value
  response_text TEXT, -- For open_ended: full text response
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id) -- One response per question per user
);

-- Assessment Results Table (scores and AI report)
CREATE TABLE IF NOT EXISTS assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  domain_scores JSONB NOT NULL, -- {"Body": 7.5, "Mind": 8.2, "Purpose": 6.8, ...}
  ai_report TEXT NOT NULL, -- Full 800-1200 word AI-generated report
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles Table (profile metadata and summary)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  has_completed_questionnaire BOOLEAN DEFAULT FALSE,
  profile_summary TEXT, -- 400-600 word comprehensive psychological analysis
  communication_tone TEXT, -- 'supportive', 'encouraging', 'motivational'
  focus_areas TEXT[], -- Array of domains needing most attention
  last_profile_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_assessment_questions_domain ON assessment_questions(domain);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_position ON assessment_questions(position);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_user ON assessment_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_question ON assessment_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_user ON assessment_results(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_questionnaire ON user_profiles(has_completed_questionnaire);

-- ============================================================================
-- PART 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: CREATE RLS POLICIES
-- ============================================================================

-- Questions are publicly readable for all authenticated users
CREATE POLICY "Anyone can read questions" ON assessment_questions
  FOR SELECT USING (true);

-- Users can only access their own responses
CREATE POLICY "Users can view own responses" ON assessment_responses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own responses" ON assessment_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own responses" ON assessment_responses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own responses" ON assessment_responses
  FOR DELETE USING (auth.uid() = user_id);

-- Users can only access their own results
CREATE POLICY "Users can view own results" ON assessment_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own results" ON assessment_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own results" ON assessment_results
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only access their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- PART 5: SEED 35 ASSESSMENT QUESTIONS
-- ============================================================================

-- Clear existing questions (if re-running)
TRUNCATE assessment_questions CASCADE;

-- BODY DOMAIN (6 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, scale_min, scale_max, scale_min_label, scale_max_label, position, weight) VALUES
('How would you rate your overall physical energy levels?', 'emoji_scale', 'Body', 1, 5, 'Constantly drained', 'Energized and vibrant', 1, 1.2),
('How many days per week do you engage in physical activity that gets your heart rate up?', 'multiple_choice', 'Body', NULL, NULL, NULL, NULL, 2, 1.0),
('How would you describe your sleep quality?', 'emoji_scale', 'Body', 1, 5, 'Poor and restless', 'Deep and refreshing', 3, 1.3),
('How satisfied are you with your eating habits and nutrition?', 'scale', 'Body', 1, 5, 'Very unsatisfied', 'Very satisfied', 4, 1.0),
('How often do you experience physical discomfort or pain that affects your daily life?', 'multiple_choice', 'Body', NULL, NULL, NULL, NULL, 5, 1.0),
('What''s one thing about your physical health you''d like to improve?', 'open_ended', 'Body', NULL, NULL, NULL, NULL, 6, 0.8);

-- MIND DOMAIN (6 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, scale_min, scale_max, scale_min_label, scale_max_label, position, weight) VALUES
('How often do you feel stressed or overwhelmed?', 'scale', 'Mind', 1, 5, 'Almost always', 'Rarely or never', 7, 1.3),
('How would you rate your current emotional wellbeing?', 'emoji_scale', 'Mind', 1, 5, 'Struggling', 'Thriving', 8, 1.2),
('Do you have practices or rituals that help you manage stress?', 'multiple_choice', 'Mind', NULL, NULL, NULL, NULL, 9, 1.0),
('How often do you take time for self-reflection or mindfulness?', 'scale', 'Mind', 1, 5, 'Never', 'Daily', 10, 1.0),
('How comfortable are you expressing your emotions to others?', 'scale', 'Mind', 1, 5, 'Very uncomfortable', 'Very comfortable', 11, 0.9),
('Describe a recent moment when you felt at peace or content.', 'open_ended', 'Mind', NULL, NULL, NULL, NULL, 12, 0.8);

-- PURPOSE DOMAIN (6 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, scale_min, scale_max, scale_min_label, scale_max_label, position, weight) VALUES
('How satisfied are you with your current work or daily activities?', 'emoji_scale', 'Purpose', 1, 5, 'Deeply unsatisfied', 'Deeply fulfilled', 13, 1.3),
('Do you feel like your work or daily activities align with your values?', 'scale', 'Purpose', 1, 5, 'Not at all', 'Completely', 14, 1.2),
('How would you describe your work-life balance?', 'multiple_choice', 'Purpose', NULL, NULL, NULL, NULL, 15, 1.0),
('How often do you feel a sense of purpose or meaning in what you do?', 'scale', 'Purpose', 1, 5, 'Rarely', 'Frequently', 16, 1.2),
('Are you working toward goals that excite you?', 'scale', 'Purpose', 1, 5, 'Not at all', 'Absolutely', 17, 1.0),
('What does success look like for you right now?', 'open_ended', 'Purpose', NULL, NULL, NULL, NULL, 18, 0.8);

-- CONNECTION DOMAIN (6 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, scale_min, scale_max, scale_min_label, scale_max_label, position, weight) VALUES
('How satisfied are you with your current relationships?', 'emoji_scale', 'Connection', 1, 5, 'Very unsatisfied', 'Very satisfied', 19, 1.2),
('How often do you have meaningful conversations with people you care about?', 'multiple_choice', 'Connection', NULL, NULL, NULL, NULL, 20, 1.0),
('Do you feel like you have a supportive community or network?', 'scale', 'Connection', 1, 5, 'Not at all', 'Absolutely', 21, 1.3),
('How often do you feel lonely or disconnected from others?', 'scale', 'Connection', 1, 5, 'Very often', 'Rarely or never', 22, 1.2),
('How comfortable are you being vulnerable with people close to you?', 'scale', 'Connection', 1, 5, 'Very uncomfortable', 'Very comfortable', 23, 0.9),
('Who or what makes you feel most connected and supported?', 'open_ended', 'Connection', NULL, NULL, NULL, NULL, 24, 0.8);

-- GROWTH DOMAIN (6 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, scale_min, scale_max, scale_min_label, scale_max_label, position, weight) VALUES
('How satisfied are you with your personal growth and development?', 'emoji_scale', 'Growth', 1, 5, 'Stagnant', 'Rapidly growing', 25, 1.2),
('How often do you engage in learning or skill-building activities?', 'multiple_choice', 'Growth', NULL, NULL, NULL, NULL, 26, 1.0),
('Do you feel challenged in ways that help you grow?', 'scale', 'Growth', 1, 5, 'Not at all', 'Absolutely', 27, 1.3),
('How comfortable are you stepping outside your comfort zone?', 'scale', 'Growth', 1, 5, 'Very uncomfortable', 'Very comfortable', 28, 1.0),
('How often do you seek feedback to improve yourself?', 'scale', 'Growth', 1, 5, 'Rarely', 'Frequently', 29, 0.9),
('What skill or area would you most like to develop?', 'open_ended', 'Growth', NULL, NULL, NULL, NULL, 30, 0.8);

-- FINANCE DOMAIN (5 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, scale_min, scale_max, scale_min_label, scale_max_label, position, weight) VALUES
('How would you rate your current financial stability?', 'emoji_scale', 'Finance', 1, 5, 'Very unstable', 'Very stable', 31, 1.3),
('How confident are you in your ability to handle unexpected expenses?', 'scale', 'Finance', 1, 5, 'Not confident', 'Very confident', 32, 1.2),
('Do you have a plan for your financial future?', 'multiple_choice', 'Finance', NULL, NULL, NULL, NULL, 33, 1.0),
('How safe and secure do you feel in your living situation?', 'scale', 'Finance', 1, 5, 'Very unsafe', 'Very safe', 34, 1.1),
('What would make you feel more financially secure?', 'open_ended', 'Finance', NULL, NULL, NULL, NULL, 35, 0.8);

-- ============================================================================
-- PART 6: ADD OPTIONS TO MULTIPLE CHOICE QUESTIONS
-- ============================================================================

-- Body Q2: Physical activity frequency
UPDATE assessment_questions SET options = '[
  {"value": "0", "label": "0 days", "score": 0},
  {"value": "1-2", "label": "1-2 days", "score": 2},
  {"value": "3-4", "label": "3-4 days", "score": 4},
  {"value": "5+", "label": "5+ days", "score": 5}
]'::jsonb WHERE position = 2;

-- Body Q5: Physical discomfort frequency
UPDATE assessment_questions SET options = '[
  {"value": "daily", "label": "Daily", "score": 0},
  {"value": "often", "label": "Frequently", "score": 1},
  {"value": "sometimes", "label": "Occasionally", "score": 3},
  {"value": "rarely", "label": "Rarely or never", "score": 5}
]'::jsonb WHERE position = 5;

-- Mind Q3: Stress management practices
UPDATE assessment_questions SET options = '[
  {"value": "no", "label": "Not really", "score": 1},
  {"value": "few", "label": "A few things that sometimes help", "score": 3},
  {"value": "yes", "label": "Yes, I have regular practices", "score": 5}
]'::jsonb WHERE position = 9;

-- Purpose Q3: Work-life balance
UPDATE assessment_questions SET options = '[
  {"value": "poor", "label": "Work dominates my life", "score": 1},
  {"value": "unbalanced", "label": "More work than life", "score": 2},
  {"value": "okay", "label": "It''s okay, could be better", "score": 3},
  {"value": "good", "label": "Pretty balanced", "score": 4},
  {"value": "excellent", "label": "Excellent balance", "score": 5}
]'::jsonb WHERE position = 15;

-- Connection Q2: Meaningful conversations
UPDATE assessment_questions SET options = '[
  {"value": "rarely", "label": "Rarely", "score": 1},
  {"value": "monthly", "label": "A few times a month", "score": 2},
  {"value": "weekly", "label": "Weekly", "score": 3},
  {"value": "several", "label": "Several times a week", "score": 4},
  {"value": "daily", "label": "Daily", "score": 5}
]'::jsonb WHERE position = 20;

-- Growth Q2: Learning frequency
UPDATE assessment_questions SET options = '[
  {"value": "rarely", "label": "Rarely or never", "score": 1},
  {"value": "monthly", "label": "Once a month", "score": 2},
  {"value": "weekly", "label": "Weekly", "score": 3},
  {"value": "several", "label": "Several times a week", "score": 4},
  {"value": "daily", "label": "Daily", "score": 5}
]'::jsonb WHERE position = 26;

-- Finance Q3: Financial planning
UPDATE assessment_questions SET options = '[
  {"value": "no", "label": "No plan at all", "score": 1},
  {"value": "vague", "label": "A vague idea", "score": 2},
  {"value": "basic", "label": "A basic plan", "score": 3},
  {"value": "solid", "label": "A solid plan", "score": 4},
  {"value": "detailed", "label": "A detailed, comprehensive plan", "score": 5}
]'::jsonb WHERE position = 33;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check that all tables were created
SELECT 'Tables created:' AS status;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('assessment_questions', 'assessment_responses', 'assessment_results', 'user_profiles');

-- Check that 35 questions were seeded
SELECT 'Total questions:', COUNT(*) FROM assessment_questions;

-- Check questions by domain
SELECT domain, COUNT(*) as question_count
FROM assessment_questions
GROUP BY domain
ORDER BY domain;

-- Check question types
SELECT question_type, COUNT(*) as count
FROM assessment_questions
GROUP BY question_type
ORDER BY question_type;

-- Check that RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('assessment_questions', 'assessment_responses', 'assessment_results', 'user_profiles');

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================

SELECT '✅ Questionnaire system setup complete!' AS status;
SELECT '📊 35 questions seeded across 6 domains' AS info;
SELECT '🔒 RLS policies enabled for all tables' AS security;
SELECT '🚀 Ready to build the questionnaire UI' AS next_step;
