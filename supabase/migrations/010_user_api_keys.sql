-- 010: bring-your-own-keys. Each user's NVIDIA NIM, OpenRouter and Deepgram keys.
-- The backend encrypts every key (Fernet, KEY_ENCRYPTION_KEY) before writing it, and only the
-- service role can touch this table: RLS is on with no policies, so no user JWT (and so no
-- dashboard or extension code) can read the ciphertext. The dashboard sees `hint` via the backend.

CREATE TABLE user_api_keys (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('nvidia_nim', 'openrouter', 'deepgram')),
    ciphertext TEXT NOT NULL,
    hint TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, provider)
);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE user_api_keys IS 'encrypted user API keys: service role only';
