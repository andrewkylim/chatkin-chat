-- Migration 010: Expand Assessment Questionnaire
-- Add 10-12 new questions covering values, identity, beliefs, and avoidance patterns

-- VALUES & MEANING (3 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, position, weight) VALUES
('What would being physically healthy allow you to do that matters to you?', 'open_ended', 'Body', 36, 0.9),
('When you imagine financial security, what does that enable in your life?', 'open_ended', 'Finance', 37, 0.9),
('What gives you a sense of meaning or purpose day-to-day?', 'open_ended', 'Purpose', 38, 1.0);

-- IDENTITY & BELIEFS (4 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, position, weight) VALUES
('How would you describe yourself when it comes to physical health?', 'open_ended', 'Body', 39, 1.0),
('Complete this sentence: "When it comes to money, I''m the kind of person who..."', 'open_ended', 'Finance', 40, 1.0),
('Do you believe you can develop new capabilities and skills, or are you limited by who you are?', 'multiple_choice', 'Growth', 41, 1.3),
('How do you typically respond when faced with a significant challenge?', 'multiple_choice', 'Mind', 42, 1.1);

-- Update Q41 options (growth mindset)
UPDATE assessment_questions SET options = '[
  {"value": "fixed", "label": "I''m limited by my natural abilities", "score": 1},
  {"value": "somewhat", "label": "I can improve a bit, but there are limits", "score": 2},
  {"value": "mostly", "label": "I can grow significantly with effort", "score": 4},
  {"value": "growth", "label": "I can develop almost any capability with work", "score": 5}
]'::jsonb WHERE position = 41;

-- Update Q42 options (challenge response)
UPDATE assessment_questions SET options = '[
  {"value": "avoid", "label": "I try to avoid it or give up quickly", "score": 1},
  {"value": "anxious", "label": "I get very anxious but push through", "score": 2},
  {"value": "steady", "label": "I take it step by step", "score": 3},
  {"value": "excited", "label": "I get energized by the challenge", "score": 5}
]'::jsonb WHERE position = 42;

-- AVOIDANCE PATTERNS (3 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, position, weight) VALUES
('What have you tried before to improve your health/fitness? What got in the way?', 'open_ended', 'Body', 43, 0.9),
('What do you avoid thinking about or dealing with right now?', 'open_ended', 'Mind', 44, 1.0),
('What stops you from taking action on things you know would help you?', 'multiple_choice', 'Growth', 45, 1.2);

-- Update Q45 options (blockers)
UPDATE assessment_questions SET options = '[
  {"value": "time", "label": "I don''t have time", "score": 2},
  {"value": "energy", "label": "I''m too tired or overwhelmed", "score": 2},
  {"value": "clarity", "label": "I don''t know where to start", "score": 3},
  {"value": "fear", "label": "Fear of failure or discomfort", "score": 2},
  {"value": "identity", "label": "It doesn''t feel like ''me''", "score": 1},
  {"value": "accountability", "label": "No one is holding me accountable", "score": 3}
]'::jsonb WHERE position = 45;

-- SELF-AWARENESS (2 questions)
INSERT INTO assessment_questions (question_text, question_type, domain, position, weight) VALUES
('When you''re struggling, who or what helps you the most?', 'open_ended', 'Connection', 46, 0.9),
('What does your inner voice say when you make a mistake or fail at something?', 'multiple_choice', 'Mind', 47, 1.2);

-- Update Q47 options (self-talk)
UPDATE assessment_questions SET options = '[
  {"value": "harsh", "label": "It''s very critical and harsh", "score": 1},
  {"value": "disappointed", "label": "It''s disappointed but not mean", "score": 2},
  {"value": "neutral", "label": "It''s pretty neutral, matter-of-fact", "score": 3},
  {"value": "kind", "label": "It''s understanding and encouraging", "score": 5}
]'::jsonb WHERE position = 47;

-- Verification
SELECT 'Assessment expansion complete' AS status;
SELECT COUNT(*) as total_questions FROM assessment_questions;
SELECT domain, COUNT(*) as count FROM assessment_questions GROUP BY domain ORDER BY domain;
