-- Clear all assessment data for testing
-- Run this in Supabase SQL editor to start fresh

-- Delete all assessment responses
DELETE FROM assessment_responses;

-- Delete all assessment results
DELETE FROM assessment_results;

-- Reset user profiles questionnaire flag
UPDATE user_profiles SET has_completed_questionnaire = false;
