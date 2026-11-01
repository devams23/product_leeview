import os

# Settings are read at import time; these stand in so the tests never need a real .env.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
for name in (
    "DEEPGRAM_API_KEY",
    "NVIDIA_NIM_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_JWT_SECRET",
):
    os.environ.setdefault(name, "test-value")
