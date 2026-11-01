-- 008: serve History one page at a time.
-- A single call returns the rows on the page plus everything the page shows about
-- the rest: the match count, the filter counts, month averages and practice totals.
-- SECURITY INVOKER keeps the existing row level security in force.

CREATE INDEX IF NOT EXISTS idx_sessions_user_activity
    ON interview_sessions (user_id, (COALESCE(completed_at, started_at)) DESC);

CREATE OR REPLACE FUNCTION history_page(
    p_search TEXT DEFAULT '',
    p_difficulty TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_sort TEXT DEFAULT 'newest',
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_timezone TEXT DEFAULT 'UTC'
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    WITH sessions AS (
        SELECT
            s.id,
            s.leetcode_slug,
            s.leetcode_title,
            s.problem_difficulty,
            s.status,
            COALESCE(s.completed_at, s.started_at) AS activity_at,
            COALESCE(
                s.total_duration_seconds,
                NULLIF(GREATEST(EXTRACT(EPOCH FROM s.completed_at - s.started_at)::INTEGER, 0), 0)
            ) AS duration_seconds,
            d.overall_score,
            d.summary
        FROM interview_sessions s
        LEFT JOIN debriefs d ON d.session_id = s.id
        WHERE s.user_id = auth.uid()
    ),
    matching AS (
        SELECT
            sessions.*,
            to_char(activity_at AT TIME ZONE p_timezone, 'YYYY-MM') AS month_key
        FROM sessions
        WHERE (
                p_search = ''
                OR position(lower(p_search) IN lower(leetcode_title)) > 0
                OR position(lower(p_search) IN lower(leetcode_slug)) > 0
            )
            AND (p_difficulty IS NULL OR problem_difficulty = p_difficulty)
            AND (p_status IS NULL OR status = p_status)
            -- Unscored interviews have nothing to rank on, so they stay out of a score order.
            AND (p_sort = 'newest' OR overall_score IS NOT NULL)
    ),
    page AS (
        SELECT *
        FROM matching
        ORDER BY
            CASE WHEN p_sort = 'lowest' THEN overall_score END ASC,
            CASE WHEN p_sort = 'highest' THEN overall_score END DESC,
            activity_at DESC,
            id
        LIMIT LEAST(p_limit, 50)
        OFFSET GREATEST(p_offset, 0)
    )
    SELECT jsonb_build_object(
        'rows', COALESCE(
            (
                SELECT jsonb_agg(to_jsonb(page) ORDER BY
                    CASE WHEN p_sort = 'lowest' THEN overall_score END ASC,
                    CASE WHEN p_sort = 'highest' THEN overall_score END DESC,
                    activity_at DESC,
                    id)
                FROM page
            ),
            '[]'::JSONB
        ),
        'total', (SELECT count(*) FROM matching),
        -- A month can run across pages, so its average comes from every match in that month.
        'month_averages', COALESCE(
            (
                SELECT jsonb_object_agg(month_key, average)
                FROM (
                    SELECT month_key, round(avg(overall_score), 1)::FLOAT AS average
                    FROM matching
                    WHERE overall_score IS NOT NULL
                    GROUP BY month_key
                ) months
            ),
            '{}'::JSONB
        ),
        'all_count', (SELECT count(*) FROM sessions),
        'difficulty_counts', COALESCE(
            (
                SELECT jsonb_object_agg(problem_difficulty, n)
                FROM (
                    SELECT problem_difficulty, count(*) AS n
                    FROM sessions
                    WHERE problem_difficulty IS NOT NULL
                    GROUP BY problem_difficulty
                ) difficulties
            ),
            '{}'::JSONB
        ),
        'status_counts', COALESCE(
            (
                SELECT jsonb_object_agg(status, n)
                FROM (SELECT status, count(*) AS n FROM sessions GROUP BY status) statuses
            ),
            '{}'::JSONB
        ),
        -- Interviews created but never started carry no activity.
        'practice_count', (SELECT count(*) FROM sessions WHERE status <> 'PREPARING'),
        'practice_seconds', (
            SELECT COALESCE(sum(duration_seconds), 0) FROM sessions WHERE status <> 'PREPARING'
        )
    );
$$;

REVOKE ALL ON FUNCTION history_page(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION history_page(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) TO authenticated;
