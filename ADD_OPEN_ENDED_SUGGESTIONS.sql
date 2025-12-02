-- Add suggested options to ALL open-ended questions
-- Users can select from suggestions or write their own custom answer

-- Position 6 (Body): What's one thing about your physical health you'd like to improve?
UPDATE assessment_questions
SET options = '[
  {"value": "Weight management", "label": "Weight management"},
  {"value": "Energy and stamina", "label": "Energy and stamina"},
  {"value": "Sleep quality", "label": "Sleep quality"},
  {"value": "Strength and fitness", "label": "Strength and fitness"},
  {"value": "Flexibility and mobility", "label": "Flexibility and mobility"},
  {"value": "Managing chronic pain or condition", "label": "Managing chronic pain or condition"}
]'::jsonb
WHERE position = 6 AND question_type = 'open_ended';

-- Position 12 (Mind): Describe a recent moment when you felt at peace or content
UPDATE assessment_questions
SET options = '[
  {"value": "Spending time in nature", "label": "Spending time in nature"},
  {"value": "Quality time with loved ones", "label": "Quality time with loved ones"},
  {"value": "After completing a task or goal", "label": "After completing a task or goal"},
  {"value": "During meditation or quiet time", "label": "During meditation or quiet time"},
  {"value": "Engaging in a hobby I love", "label": "Engaging in a hobby I love"},
  {"value": "Can''t remember feeling at peace recently", "label": "Can''t remember feeling at peace recently"}
]'::jsonb
WHERE position = 12 AND question_type = 'open_ended';

-- Position 18 (Purpose): What does success look like for you right now?
UPDATE assessment_questions
SET options = '[
  {"value": "Career advancement and recognition", "label": "Career advancement and recognition"},
  {"value": "Financial stability and security", "label": "Financial stability and security"},
  {"value": "Better work-life balance", "label": "Better work-life balance"},
  {"value": "Personal growth and learning", "label": "Personal growth and learning"},
  {"value": "Meaningful relationships and connections", "label": "Meaningful relationships and connections"},
  {"value": "Health and wellbeing", "label": "Health and wellbeing"}
]'::jsonb
WHERE position = 18 AND question_type = 'open_ended';

-- Position 24 (Connection): Who or what makes you feel most connected and supported?
UPDATE assessment_questions
SET options = '[
  {"value": "Family members", "label": "Family members"},
  {"value": "Close friends", "label": "Close friends"},
  {"value": "Partner or spouse", "label": "Partner or spouse"},
  {"value": "Community or group", "label": "Community or group"},
  {"value": "Pets or nature", "label": "Pets or nature"},
  {"value": "Don''t feel very connected right now", "label": "Don''t feel very connected right now"}
]'::jsonb
WHERE position = 24 AND question_type = 'open_ended';

-- Position 30 (Growth): What skill or area would you most like to develop?
UPDATE assessment_questions
SET options = '[
  {"value": "Leadership and management", "label": "Leadership and management"},
  {"value": "Technical or professional skills", "label": "Technical or professional skills"},
  {"value": "Communication and relationships", "label": "Communication and relationships"},
  {"value": "Creative or artistic abilities", "label": "Creative or artistic abilities"},
  {"value": "Physical fitness or health", "label": "Physical fitness or health"},
  {"value": "Financial literacy and planning", "label": "Financial literacy and planning"}
]'::jsonb
WHERE position = 30 AND question_type = 'open_ended';

-- Position 35 (Security): What would make you feel more financially secure?
UPDATE assessment_questions
SET options = '[
  {"value": "Higher income or salary", "label": "Higher income or salary"},
  {"value": "Larger emergency fund savings", "label": "Larger emergency fund savings"},
  {"value": "Less debt or financial obligations", "label": "Less debt or financial obligations"},
  {"value": "More stable employment", "label": "More stable employment"},
  {"value": "Better investment or retirement plan", "label": "Better investment or retirement plan"},
  {"value": "Multiple income streams", "label": "Multiple income streams"}
]'::jsonb
WHERE position = 35 AND question_type = 'open_ended';
