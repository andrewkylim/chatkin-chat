-- Fix questionnaire: Add missing options for multiple_choice questions

-- Update question 2: "How many days per week do you engage in physical activity..."
UPDATE assessment_questions
SET options = '[
  {"value": "0", "label": "0 days", "score": 1},
  {"value": "1-2", "label": "1-2 days", "score": 3},
  {"value": "3-4", "label": "3-4 days", "score": 4},
  {"value": "5+", "label": "5+ days", "score": 5}
]'::jsonb
WHERE position = 2 AND question_type = 'multiple_choice';

-- Update question 5: "How often do you experience physical discomfort or pain..."
UPDATE assessment_questions
SET options = '[
  {"value": "never", "label": "Rarely or never", "score": 5},
  {"value": "occasionally", "label": "Occasionally", "score": 4},
  {"value": "weekly", "label": "Weekly", "score": 3},
  {"value": "daily", "label": "Daily", "score": 2},
  {"value": "constant", "label": "Almost constantly", "score": 1}
]'::jsonb
WHERE position = 5 AND question_type = 'multiple_choice';

-- Update question 9: "How much time per day do you spend on focused, deep work..."
UPDATE assessment_questions
SET options = '[
  {"value": "<1hr", "label": "Less than 1 hour", "score": 2},
  {"value": "1-2hrs", "label": "1-2 hours", "score": 3},
  {"value": "3-4hrs", "label": "3-4 hours", "score": 4},
  {"value": "5+hrs", "label": "5+ hours", "score": 5}
]'::jsonb
WHERE position = 9 AND question_type = 'multiple_choice';

-- Update question 13: "How often do you feel truly aligned with your sense of purpose..."
UPDATE assessment_questions
SET options = '[
  {"value": "rarely", "label": "Rarely", "score": 2},
  {"value": "sometimes", "label": "Sometimes", "score": 3},
  {"value": "often", "label": "Often", "score": 4},
  {"value": "always", "label": "Almost always", "score": 5}
]'::jsonb
WHERE position = 13 AND question_type = 'multiple_choice';

-- Update question 17: "How much time do you dedicate to meaningful relationships each week..."
UPDATE assessment_questions
SET options = '[
  {"value": "<2hrs", "label": "Less than 2 hours", "score": 2},
  {"value": "2-5hrs", "label": "2-5 hours", "score": 3},
  {"value": "6-10hrs", "label": "6-10 hours", "score": 4},
  {"value": "10+hrs", "label": "10+ hours", "score": 5}
]'::jsonb
WHERE position = 17 AND question_type = 'multiple_choice';

-- Update question 21: "How often do you challenge yourself to learn new things..."
UPDATE assessment_questions
SET options = '[
  {"value": "rarely", "label": "Rarely", "score": 2},
  {"value": "monthly", "label": "Monthly", "score": 3},
  {"value": "weekly", "label": "Weekly", "score": 4},
  {"value": "daily", "label": "Daily", "score": 5}
]'::jsonb
WHERE position = 21 AND question_type = 'multiple_choice';

-- Update question 25: "How prepared do you feel for unexpected financial challenges..."
UPDATE assessment_questions
SET options = '[
  {"value": "unprepared", "label": "Not prepared at all", "score": 1},
  {"value": "somewhat", "label": "Somewhat prepared", "score": 3},
  {"value": "prepared", "label": "Well prepared", "score": 4},
  {"value": "very", "label": "Very well prepared", "score": 5}
]'::jsonb
WHERE position = 25 AND question_type = 'multiple_choice';

-- Update question 29: "How satisfied are you with your current career or work situation..."
UPDATE assessment_questions
SET options = '[
  {"value": "very-unsatisfied", "label": "Very unsatisfied", "score": 1},
  {"value": "unsatisfied", "label": "Unsatisfied", "score": 2},
  {"value": "neutral", "label": "Neutral", "score": 3},
  {"value": "satisfied", "label": "Satisfied", "score": 4},
  {"value": "very-satisfied", "label": "Very satisfied", "score": 5}
]'::jsonb
WHERE position = 29 AND question_type = 'multiple_choice';
