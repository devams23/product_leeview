import os
from typing import Optional

import jwt
from dotenv import load_dotenv
from fastapi import Header, HTTPException, Depends
from pydantic import BaseModel, ValidationError

# Must run before reading the secret: uvicorn does not load .env by itself.
load_dotenv()

# Load Supabase JWT secret (the same secret used by Supabase to sign JWTs)
# In a real deployment this should come from a secure secret store.
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
if not SUPABASE_JWT_SECRET:
    raise RuntimeError("SUPABASE_JWT_SECRET environment variable is not set")

class TokenPayload(BaseModel):
    sub: str  # user id
    aud: str
    exp: int
    iat: int
    role: Optional[str] = None

def verify_jwt(token: str) -> TokenPayload:
    """Validate a Supabase JWT and return its payload.

    Raises HTTPException(401) if verification fails.
    """
    try:
        payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
        return TokenPayload(**payload)
    except (jwt.InvalidTokenError, ValidationError) as exc:
        raise HTTPException(status_code=401, detail="Invalid authentication token") from exc

async def get_raw_jwt(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header missing or malformed")
    token = authorization.split(" ", 1)[1]
    # Optionally verify it before returning the string
    verify_jwt(token)
    return token

async def get_current_user(token: str = Depends(get_raw_jwt)) -> TokenPayload:
    return verify_jwt(token)

# Helper to obtain a Supabase client bound to a specific user token.
# This avoids using the admin service‑role key for regular operations.
from supabase import create_client, Client
from supabase.lib.client_options import SyncClientOptions
from config import Settings, get_settings

def supabase_for_user(user_jwt: str) -> Client:
    settings: Settings = get_settings()
    # supabase-py 2.x has no auth.set_auth; the user's JWT goes in as the Authorization
    # header so PostgREST evaluates RLS as that user.
    options = SyncClientOptions(headers={"Authorization": f"Bearer {user_jwt}"})
    return create_client(settings.supabase_url, settings.supabase_anon_key, options=options)
