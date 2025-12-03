-- Migration 018: Convert Open-Ended Questions to Multiple Choice
-- Convert the 6 open-ended questions from migration 010 to multiple_choice with "Other" option
-- This makes the questionnaire easier to complete while still allowing custom responses

-- Q36: What would being physically healthy allow you to do that matters to you?
UPDATE assessment_questions
SET question_type = 'multiple_choice',
    options = '[
      {"value": "energy", "label": "Have more energy for my family and work", "score": 3},
      {"value": "activities", "label": "Do activities I love without limitations", "score": 3},
      {"value": "confidence", "label": "Feel more confident and capable", "score": 3},
      {"value": "longevity", "label": "Live longer and see my kids grow up", "score": 4},
      {"value": "pain-free", "label": "Live without pain or discomfort", "score": 4}
    ]'::jsonb
WHERE position = 36;

-- Q37: When you imagine financial security, what does that enable in your life?
UPDATE assessment_questions
SET question_type = 'multiple_choice',
    options = '[
      {"value": "stress", "label": "Stop worrying about money constantly", "score": 3},
      {"value": "freedom", "label": "Freedom to make choices without financial pressure", "score": 4},
      {"value": "family", "label": "Provide better for my family", "score": 3},
      {"value": "future", "label": "Feel secure about the future", "score": 3},
      {"value": "opportunities", "label": "Pursue opportunities I''m currently missing", "score": 4}
    ]'::jsonb
WHERE position = 37;

-- Q38: What gives you a sense of meaning or purpose day-to-day?
UPDATE assessment_questions
SET question_type = 'multiple_choice',
    options = '[
      {"value": "family", "label": "Taking care of my family", "score": 4},
      {"value": "work", "label": "My work and professional growth", "score": 4},
      {"value": "helping", "label": "Helping others and making a difference", "score": 4},
      {"value": "creating", "label": "Creating or building something", "score": 4},
      {"value": "learning", "label": "Learning and personal development", "score": 3},
      {"value": "unclear", "label": "I''m not sure / searching for it", "score": 1}
    ]'::jsonb
WHERE position = 38;

-- Q39: How would you describe yourself when it comes to physical health?
UPDATE assessment_questions
SET question_type = 'multiple_choice',
    options = '[
      {"value": "prioritize", "label": "I prioritize it and stay consistent", "score": 5},
      {"value": "inconsistent", "label": "I try but I''m inconsistent", "score": 3},
      {"value": "struggling", "label": "I''m struggling and know I need to change", "score": 2},
      {"value": "neglect", "label": "I tend to neglect it for other priorities", "score": 1},
      {"value": "health-issues", "label": "I have health issues that make it harder", "score": 2}
    ]'::jsonb
WHERE position = 39;

-- Q40: Complete this sentence: "When it comes to money, I'm the kind of person who..."
UPDATE assessment_questions
SET question_type = 'multiple_choice',
    options = '[
      {"value": "saver", "label": "Saves and plans carefully", "score": 5},
      {"value": "spender", "label": "Lives in the moment, spends freely", "score": 2},
      {"value": "anxious", "label": "Worries about it constantly", "score": 2},
      {"value": "avoids", "label": "Avoids thinking about it", "score": 1},
      {"value": "learning", "label": "Is learning to manage it better", "score": 3},
      {"value": "paycheck", "label": "Lives paycheck to paycheck", "score": 1}
    ]'::jsonb
WHERE position = 40;

-- Q43: What have you tried before to improve your health/fitness? What got in the way?
UPDATE assessment_questions
SET question_type = 'multiple_choice',
    options = '[
      {"value": "gyms", "label": "Gym memberships - lost motivation", "score": 2},
      {"value": "diets", "label": "Diets - too restrictive or hard to stick to", "score": 2},
      {"value": "time", "label": "Started strong but ran out of time", "score": 2},
      {"value": "injury", "label": "Tried but got injured or burned out", "score": 2},
      {"value": "nothing", "label": "Haven''t really tried yet", "score": 1},
      {"value": "works", "label": "Found things that work for me", "score": 4}
    ]'::jsonb
WHERE position = 43;

-- Q44: What do you avoid thinking about or dealing with right now?
UPDATE assessment_questions
SET question_type = 'multiple_choice',
    options = '[
      {"value": "health", "label": "My physical or mental health", "score": 2},
      {"value": "money", "label": "Financial situation or planning", "score": 2},
      {"value": "relationships", "label": "Difficult conversations or relationships", "score": 2},
      {"value": "career", "label": "Career direction or job satisfaction", "score": 2},
      {"value": "future", "label": "The future and big life decisions", "score": 2},
      {"value": "nothing", "label": "I face things pretty directly", "score": 5}
    ]'::jsonb
WHERE position = 44;

-- Q46: When you're struggling, who or what helps you the most?
UPDATE assessment_questions
SET question_type = 'multiple_choice',
    options = '[
      {"value": "partner", "label": "My partner or spouse", "score": 5},
      {"value": "family", "label": "Family members", "score": 4},
      {"value": "friends", "label": "Close friends", "score": 4},
      {"value": "myself", "label": "I work through it myself", "score": 2},
      {"value": "nothing", "label": "I don''t really have support", "score": 1},
      {"value": "therapy", "label": "Therapist or coach", "score": 4}
    ]'::jsonb
WHERE position = 46;

-- Verification
SELECT 'Open-ended questions converted to multiple choice' AS status;

-- Show updated questions
SELECT position, question_text, question_type,
       CASE WHEN options IS NOT NULL THEN jsonb_array_length(options) ELSE 0 END as option_count
FROM assessment_questions
WHERE position IN (36, 37, 38, 39, 40, 43, 44, 46)
ORDER BY position;
