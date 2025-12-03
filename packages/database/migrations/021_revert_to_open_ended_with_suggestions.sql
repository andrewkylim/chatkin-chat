-- Migration 021: Revert Multiple Choice Questions to Open-Ended with Suggestions
-- Convert the 8 questions from migration 018 back to open_ended format with suggestions
-- This provides better UX - users can pick from suggestions OR write custom responses

-- Q36: What would being physically healthy allow you to do that matters to you?
UPDATE assessment_questions
SET question_type = 'open_ended',
    options = '[
      {"value": "Have more energy for my family and work", "label": "Have more energy for my family and work"},
      {"value": "Do activities I love without limitations", "label": "Do activities I love without limitations"},
      {"value": "Feel more confident and capable", "label": "Feel more confident and capable"},
      {"value": "Live longer and see my kids grow up", "label": "Live longer and see my kids grow up"},
      {"value": "Live without pain or discomfort", "label": "Live without pain or discomfort"}
    ]'::jsonb
WHERE position = 36;

-- Q37: When you imagine financial security, what does that enable in your life?
UPDATE assessment_questions
SET question_type = 'open_ended',
    options = '[
      {"value": "Stop worrying about money constantly", "label": "Stop worrying about money constantly"},
      {"value": "Freedom to make choices without financial pressure", "label": "Freedom to make choices without financial pressure"},
      {"value": "Provide better for my family", "label": "Provide better for my family"},
      {"value": "Feel secure about the future", "label": "Feel secure about the future"},
      {"value": "Pursue opportunities I''m currently missing", "label": "Pursue opportunities I''m currently missing"}
    ]'::jsonb
WHERE position = 37;

-- Q38: What gives you a sense of meaning or purpose day-to-day?
UPDATE assessment_questions
SET question_type = 'open_ended',
    options = '[
      {"value": "Taking care of my family", "label": "Taking care of my family"},
      {"value": "My work and professional growth", "label": "My work and professional growth"},
      {"value": "Helping others and making a difference", "label": "Helping others and making a difference"},
      {"value": "Creating or building something", "label": "Creating or building something"},
      {"value": "Learning and personal development", "label": "Learning and personal development"},
      {"value": "I''m not sure / searching for it", "label": "I''m not sure / searching for it"}
    ]'::jsonb
WHERE position = 38;

-- Q39: How would you describe yourself when it comes to physical health?
UPDATE assessment_questions
SET question_type = 'open_ended',
    options = '[
      {"value": "I prioritize it and stay consistent", "label": "I prioritize it and stay consistent"},
      {"value": "I try but I''m inconsistent", "label": "I try but I''m inconsistent"},
      {"value": "I''m struggling and know I need to change", "label": "I''m struggling and know I need to change"},
      {"value": "I tend to neglect it for other priorities", "label": "I tend to neglect it for other priorities"},
      {"value": "I have health issues that make it harder", "label": "I have health issues that make it harder"}
    ]'::jsonb
WHERE position = 39;

-- Q40: Complete this sentence: "When it comes to money, I'm the kind of person who..."
UPDATE assessment_questions
SET question_type = 'open_ended',
    options = '[
      {"value": "Saves and plans carefully", "label": "Saves and plans carefully"},
      {"value": "Lives in the moment, spends freely", "label": "Lives in the moment, spends freely"},
      {"value": "Worries about it constantly", "label": "Worries about it constantly"},
      {"value": "Avoids thinking about it", "label": "Avoids thinking about it"},
      {"value": "Is learning to manage it better", "label": "Is learning to manage it better"},
      {"value": "Lives paycheck to paycheck", "label": "Lives paycheck to paycheck"}
    ]'::jsonb
WHERE position = 40;

-- Q43: What have you tried before to improve your health/fitness? What got in the way?
UPDATE assessment_questions
SET question_type = 'open_ended',
    options = '[
      {"value": "Gym memberships - lost motivation", "label": "Gym memberships - lost motivation"},
      {"value": "Diets - too restrictive or hard to stick to", "label": "Diets - too restrictive or hard to stick to"},
      {"value": "Started strong but ran out of time", "label": "Started strong but ran out of time"},
      {"value": "Tried but got injured or burned out", "label": "Tried but got injured or burned out"},
      {"value": "Haven''t really tried yet", "label": "Haven''t really tried yet"},
      {"value": "Found things that work for me", "label": "Found things that work for me"}
    ]'::jsonb
WHERE position = 43;

-- Q44: What do you avoid thinking about or dealing with right now?
UPDATE assessment_questions
SET question_type = 'open_ended',
    options = '[
      {"value": "My physical or mental health", "label": "My physical or mental health"},
      {"value": "Financial situation or planning", "label": "Financial situation or planning"},
      {"value": "Difficult conversations or relationships", "label": "Difficult conversations or relationships"},
      {"value": "Career direction or job satisfaction", "label": "Career direction or job satisfaction"},
      {"value": "The future and big life decisions", "label": "The future and big life decisions"},
      {"value": "I face things pretty directly", "label": "I face things pretty directly"}
    ]'::jsonb
WHERE position = 44;

-- Q46: When you're struggling, who or what helps you the most?
UPDATE assessment_questions
SET question_type = 'open_ended',
    options = '[
      {"value": "My partner or spouse", "label": "My partner or spouse"},
      {"value": "Family members", "label": "Family members"},
      {"value": "Close friends", "label": "Close friends"},
      {"value": "I work through it myself", "label": "I work through it myself"},
      {"value": "I don''t really have support", "label": "I don''t really have support"},
      {"value": "Therapist or coach", "label": "Therapist or coach"}
    ]'::jsonb
WHERE position = 46;

-- Verification
SELECT 'Questions converted to open_ended with suggestions' AS status;

-- Show updated questions
SELECT position, question_text, question_type,
       CASE WHEN options IS NOT NULL THEN jsonb_array_length(options) ELSE 0 END as suggestion_count
FROM assessment_questions
WHERE position IN (36, 37, 38, 39, 40, 43, 44, 46)
ORDER BY position;
