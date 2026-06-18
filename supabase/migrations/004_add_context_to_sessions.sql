-- Add problem context columns to interview_sessions
ALTER TABLE interview_sessions
ADD COLUMN problem_description TEXT,
ADD COLUMN problem_topics JSONB DEFAULT '[]'::jsonb,
ADD COLUMN problem_language TEXT;
