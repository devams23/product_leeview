-- Enable RLS on all tables
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debriefs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own interview sessions
CREATE POLICY "Users can view own sessions" ON interview_sessions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions" ON interview_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Same pattern for all related tables (join through interview_sessions)
CREATE POLICY "Users can view own transcripts" ON transcript_logs
    FOR SELECT USING (session_id IN (
        SELECT id FROM interview_sessions WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can view own code snapshots" ON code_snapshots
    FOR SELECT USING (session_id IN (
        SELECT id FROM interview_sessions WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can view own debriefs" ON debriefs
    FOR SELECT USING (session_id IN (
        SELECT id FROM interview_sessions WHERE user_id = auth.uid()
    ));
