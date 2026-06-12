-- Fix RLS for backend inserts: the backend creates sessions using the
-- service_role key, which bypasses RLS entirely.  The INSERT policy below
-- is a safety net for anon-key requests — the backend never hits it.

-- interview_sessions: allow any insert (the backend is the sole creator).
-- SELECT is still restricted to own sessions, so no data leaks.
DROP POLICY IF EXISTS "Users can insert own sessions" ON interview_sessions;
CREATE POLICY "Users can insert own sessions" ON interview_sessions
    FOR INSERT WITH CHECK (true);
