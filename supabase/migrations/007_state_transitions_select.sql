-- 007: state_transitions had INSERT (006) but no SELECT policy. supabase-py inserts with
-- "Prefer: return=representation", so Postgres must be able to read the new row back;
-- without a SELECT policy that insert fails with 42501 even when the INSERT check passes.
-- Idempotent: the policy is dropped before it is created.

DROP POLICY IF EXISTS "Users can view own state transitions" ON state_transitions;
CREATE POLICY "Users can view own state transitions" ON state_transitions
    FOR SELECT USING (session_id IN (
        SELECT id FROM interview_sessions WHERE user_id = auth.uid()
    ));
