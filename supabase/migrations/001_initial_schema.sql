-- interview_sessions table
CREATE TABLE interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    leetcode_slug TEXT NOT NULL,
    leetcode_title TEXT NOT NULL,
    problem_difficulty TEXT,
    status TEXT NOT NULL DEFAULT 'PREPARING' CHECK (status IN ('PREPARING', 'ACTIVE', 'COMPLETED', 'INTERRUPTED')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_duration_seconds INTEGER
);

-- transcript_logs table
CREATE TABLE transcript_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    speaker TEXT NOT NULL CHECK (speaker IN ('USER', 'AI')),
    text TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    state_at_time TEXT NOT NULL
);

-- code_snapshots table
CREATE TABLE code_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- state_transitions table
CREATE TABLE state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    transitioned_at TIMESTAMPTZ DEFAULT NOW(),
    triggered_by TEXT NOT NULL CHECK (triggered_by IN ('LLM_SUGGESTION', 'USER_ACTION', 'TIMEOUT', 'BACKEND_OVERRIDE'))
);

-- debriefs table
CREATE TABLE debriefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE UNIQUE,
    approach_score INTEGER CHECK (approach_score BETWEEN 1 AND 10),
    communication_score INTEGER CHECK (communication_score BETWEEN 1 AND 10),
    code_correctness_score INTEGER CHECK (code_correctness_score BETWEEN 1 AND 10),
    code_quality_score INTEGER CHECK (code_quality_score BETWEEN 1 AND 10),
    time_management_score INTEGER CHECK (time_management_score BETWEEN 1 AND 10),
    overall_score INTEGER CHECK (overall_score BETWEEN 1 AND 10),
    actionable_feedback JSONB DEFAULT '[]'::jsonb,
    similar_problems JSONB DEFAULT '[]'::jsonb,
    real_world_scenario TEXT,
    real_world_naive_approach TEXT,
    real_world_why_wins TEXT,
    senior_follow_up TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sessions_user ON interview_sessions(user_id);
CREATE INDEX idx_transcripts_session ON transcript_logs(session_id);
CREATE INDEX idx_snapshots_session ON code_snapshots(session_id);
CREATE INDEX idx_transitions_session ON state_transitions(session_id);
