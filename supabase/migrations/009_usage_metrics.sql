-- 009: internal per-turn latency and per-session cost metrics.
-- Written by the backend with the service role only. RLS is on with no policies,
-- so no user JWT can read or write these tables.

CREATE TABLE turn_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    turn_index INTEGER NOT NULL,
    state TEXT NOT NULL,
    kind TEXT NOT NULL,
    llm_ms INTEGER,
    llm_first_token_ms INTEGER,
    tts_first_audio_ms INTEGER,
    first_audio_ms INTEGER,
    total_ms INTEGER,
    tts_chars INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    llm_attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_turn_metrics_session ON turn_metrics (session_id);

CREATE TABLE session_usage (
    session_id UUID PRIMARY KEY REFERENCES interview_sessions(id) ON DELETE CASCADE,
    turns INTEGER NOT NULL DEFAULT 0,
    tts_characters INTEGER NOT NULL DEFAULT 0,
    llm_input_tokens INTEGER NOT NULL DEFAULT 0,
    llm_output_tokens INTEGER NOT NULL DEFAULT 0,
    llm_calls INTEGER NOT NULL DEFAULT 0,
    stt_seconds INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE turn_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_usage ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE turn_metrics IS 'internal metrics: service role only';
COMMENT ON TABLE session_usage IS 'internal metrics: service role only';
