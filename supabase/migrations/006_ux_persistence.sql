-- 006: let the backend persist interview data under the user's own JWT.
-- The backend writes with a per-user client (anon key + user token), so RLS must
-- allow inserts/updates for sessions the user owns. Idempotent: every policy is
-- dropped before it is created.

-- interview_sessions: 003 opened INSERT to everyone; restore the ownership check.
DROP POLICY IF EXISTS "Users can insert own sessions" ON interview_sessions;
CREATE POLICY "Users can insert own sessions" ON interview_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- interview_sessions: status / completed_at / total_duration_seconds updates.
DROP POLICY IF EXISTS "Users can update own sessions" ON interview_sessions;
CREATE POLICY "Users can update own sessions" ON interview_sessions
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- transcript_logs
DROP POLICY IF EXISTS "Users can insert own transcripts" ON transcript_logs;
CREATE POLICY "Users can insert own transcripts" ON transcript_logs
    FOR INSERT WITH CHECK (session_id IN (
        SELECT id FROM interview_sessions WHERE user_id = auth.uid()
    ));

-- code_snapshots
DROP POLICY IF EXISTS "Users can insert own code snapshots" ON code_snapshots;
CREATE POLICY "Users can insert own code snapshots" ON code_snapshots
    FOR INSERT WITH CHECK (session_id IN (
        SELECT id FROM interview_sessions WHERE user_id = auth.uid()
    ));

-- state_transitions
DROP POLICY IF EXISTS "Users can insert own state transitions" ON state_transitions;
CREATE POLICY "Users can insert own state transitions" ON state_transitions
    FOR INSERT WITH CHECK (session_id IN (
        SELECT id FROM interview_sessions WHERE user_id = auth.uid()
    ));

-- debriefs
DROP POLICY IF EXISTS "Users can insert own debriefs" ON debriefs;
CREATE POLICY "Users can insert own debriefs" ON debriefs
    FOR INSERT WITH CHECK (session_id IN (
        SELECT id FROM interview_sessions WHERE user_id = auth.uid()
    ));
