-- Add DELETE policy for assessment_results table
-- This allows users to delete their own assessment results (needed for retake functionality)

CREATE POLICY "Users can delete own results"
ON assessment_results
FOR DELETE
TO public
USING (auth.uid() = user_id);
