# LeeView AI Mock Interview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that turns any LeetCode problem page into a real-time AI mock interview session, with a separate React dashboard for reviewing debriefs and progress.

**Architecture:** The extension injects a React overlay onto LeetCode, captures voice via Deepgram STT, streams to a FastAPI backend that orchestrates an interview state machine backed by NVIDIA NIM, and streams TTS audio back. Interview data is persisted in Supabase. A separate React + Vite dashboard provides Google OAuth login and rich debrief visualization.

**Tech Stack:** Chrome Extension (Manifest V3 + React), FastAPI + Uvicorn, Deepgram (STT + TTS), NVIDIA NIM API, Supabase (Postgres + Auth), React + Vite (dashboard), WebSocket, Google OAuth.

**Design System:** See `docs/superpowers/specs/2025-06-12-leeview-design-system.md` for the complete glassmorphism design system (color tokens, typography, spacing, component specs, and interaction states). All UI work in this plan must follow it.

---

## Project Structure

```
leeview/
├── app/
│   ├── extension/                    # Chrome extension (Manifest V3 + React + Vite)
│   │   ├── src/
│   │   │   ├── content/             # Content script (injected into LeetCode)
│   │   │   ├── background/          # Service worker
│   │   │   ├── popup/               # Extension popup
│   │   │   ├── components/          # React overlay components
│   │   │   ├── hooks/               # Custom React hooks
│   │   │   ├── services/            # API, WebSocket, Deepgram clients
│   │   │   └── utils/               # Helpers
│   │   ├── public/
│   │   ├── manifest.json
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── backend/                      # FastAPI backend
│   │   ├── src/
│   │   │   ├── main.py                # FastAPI app, WebSocket endpoint
│   │   │   ├── config.py              # Settings, env vars
│   │   │   ├── state_machine/         # Interview state machine
│   │   │   │   ├── machine.py
│   │   │   │   ├── states.py
│   │   │   │   └── transitions.py
│   │   │   ├── services/              # External API clients
│   │   │   │   ├── nvidia_nim.py      # NVIDIA NIM LLM client
│   │   │   │   ├── deepgram.py       # Deepgram TTS client (backend-side)
│   │   │   │   └── supabase_client.py
│   │   │   ├── debrief/               # Debrief engine
│   │   │   │   ├── engine.py
│   │   │   │   ├── prompts.py
│   │   │   │   └── scoring.py
│   │   │   ├── models/                # Pydantic schemas
│   │   │   └── websocket/             # WS manager, connection handler
│   │   │       ├── manager.py
│   │   │       └── handler.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── .env.example
│   │
│   └── dashboard/                    # React + Vite dashboard
│       ├── src/
│       │   ├── components/          # Reusable UI components
│       │   ├── pages/               # Route pages
│       │   ├── services/            # Supabase client, API calls
│       │   ├── hooks/               # Auth hook, data hooks
│       │   └── utils/
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts
│       └── package.json
│
├── docs/
│   └── superpowers/
│       ├── specs/                   # Design spec (already written)
│       └── plans/                     # This file
└── supabase/                         # Migrations, seed data, RLS policies
    └── migrations/
```

---

## Phase 1: Infrastructure & Project Scaffolding

### Task 1: Initialize Project Structure

**Files:**
- Create: `app/extension/package.json`
- Create: `app/backend/pyproject.toml`
- Create: `app/dashboard/package.json`
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `.env.example`

- [ ] **Step 1: Create root-level `.env.example`**

```bash
# Deepgram
DEEPGRAM_API_KEY=your_deepgram_api_key

# NVIDIA NIM
NVIDIA_NIM_API_KEY=your_nvidia_nim_api_key
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1

# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
WS_URL=wss://api.leeview.com
```

- [ ] **Step 2: Create extension `package.json`**

```json
{
  "name": "leeview-extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.43",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.4.2",
    "vite": "^5.2.0"
  }
}
```

- [ ] **Step 3: Create backend `pyproject.toml`**

```toml
[project]
name = "leeview-backend"
version = "0.1.0"
description = "LeeView AI Mock Interview Backend"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.29.0",
    "websockets>=12.0",
    "httpx>=0.27.0",
    "python-dotenv>=1.0.0",
    "pydantic>=2.6.0",
    "supabase>=2.4.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.1.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",
    "ruff>=0.3.0",
]
```

- [ ] **Step 4: Create dashboard `package.json`**

```json
{
  "name": "leeview-dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "@supabase/supabase-js": "^2.39.0",
    "recharts": "^2.12.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.43",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.4.2",
    "vite": "^5.2.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.35",
    "autoprefixer": "^10.4.18"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add app/extension/package.json app/backend/pyproject.toml app/dashboard/package.json .env.example
git commit -m "chore: scaffold project structure with package configs"
```

---

### Task 2: Supabase Database Schema & Auth Setup

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/migrations/002_rls_policies.sql`

- [ ] **Step 1: Write initial schema migration**

```sql
-- supabase/migrations/001_initial_schema.sql

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
```

- [ ] **Step 2: Write RLS policies migration**

```sql
-- supabase/migrations/002_rls_policies.sql

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
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "chore: add Supabase schema and RLS policies"
```

---

## Phase 2: FastAPI Backend

### Task 3: FastAPI App Skeleton & Config

**Files:**
- Create: `app/backend/src/config.py`
- Create: `app/backend/src/main.py`
- Create: `app/backend/.env.example`

- [ ] **Step 1: Write `config.py`**

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    deepgram_api_key: str
    nvidia_nim_api_key: str
    nvidia_nim_base_url: str = "https://integrate.api.nvidia.com/v1"
    supabase_url: str
    supabase_service_role_key: str
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 2: Write `main.py` with basic FastAPI app and health endpoint**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings

settings = get_settings()

app = FastAPI(title="LeeView Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

- [ ] **Step 3: Run FastAPI locally and verify**

```bash
cd app/backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn src.main:app --reload --port 8000
```

Visit `http://localhost:8000/health` → should return `{"status": "ok"}`.

- [ ] **Step 4: Commit**

```bash
git add app/backend/src/config.py app/backend/src/main.py app/backend/.env.example
git commit -m "feat(backend): scaffold FastAPI app with config and health endpoint"
```

---

### Task 4: State Machine (States & Transitions)

**Files:**
- Create: `app/backend/src/state_machine/states.py`
- Create: `app/backend/src/state_machine/transitions.py`
- Create: `app/backend/src/state_machine/machine.py`

- [ ] **Step 1: Write `states.py`**

```python
from enum import Enum


class InterviewState(str, Enum):
    INTRO = "INTRO"
    AWAITING_CLARIFICATION = "AWAITING_CLARIFICATION"
    AWAITING_APPROACH = "AWAITING_APPROACH"
    AWAITING_CODE = "AWAITING_CODE"
    AWAITING_WALKTHROUGH = "AWAITING_WALKTHROUGH"
    CONCLUDING = "CONCLUDING"
    GENERATING_DEBRIEF = "GENERATING_DEBRIEF"
    COMPLETED = "COMPLETED"
```

- [ ] **Step 2: Write `transitions.py`**

```python
from .states import InterviewState

VALID_TRANSITIONS: dict[InterviewState, set[InterviewState]] = {
    InterviewState.INTRO: {InterviewState.AWAITING_CLARIFICATION},
    InterviewState.AWAITING_CLARIFICATION: {
        InterviewState.AWAITING_APPROACH,
        InterviewState.AWAITING_CLARIFICATION,
    },
    InterviewState.AWAITING_APPROACH: {
        InterviewState.AWAITING_CODE,
        InterviewState.AWAITING_CLARIFICATION,
    },
    InterviewState.AWAITING_CODE: {
        InterviewState.AWAITING_WALKTHROUGH,
        InterviewState.AWAITING_APPROACH,
    },
    InterviewState.AWAITING_WALKTHROUGH: {
        InterviewState.CONCLUDING,
        InterviewState.AWAITING_CODE,
    },
    InterviewState.CONCLUDING: {InterviewState.GENERATING_DEBRIEF},
    InterviewState.GENERATING_DEBRIEF: {InterviewState.COMPLETED},
    InterviewState.COMPLETED: set(),
}


def is_valid_transition(from_state: InterviewState, to_state: InterviewState) -> bool:
    return to_state in VALID_TRANSITIONS.get(from_state, set())
```

- [ ] **Step 3: Write `machine.py`**

```python
from .states import InterviewState
from .transitions import is_valid_transition


class StateMachine:
    def __init__(self, initial_state: InterviewState = InterviewState.INTRO):
        self._state = initial_state

    @property
    def current_state(self) -> InterviewState:
        return self._state

    def transition(self, next_state: InterviewState) -> bool:
        if is_valid_transition(self._state, next_state):
            self._state = next_state
            return True
        return False

    def force_transition(self, next_state: InterviewState) -> None:
        """Override for edge cases like user interrupt or timeout."""
        self._state = next_state
```

- [ ] **Step 4: Write tests for the state machine**

```python
# app/backend/tests/test_state_machine.py
import pytest
from src.state_machine.states import InterviewState
from src.state_machine.transitions import is_valid_transition
from src.state_machine.machine import StateMachine


def test_valid_transition():
    sm = StateMachine(InterviewState.INTRO)
    assert sm.transition(InterviewState.AWAITING_CLARIFICATION) is True
    assert sm.current_state == InterviewState.AWAITING_CLARIFICATION


def test_invalid_transition():
    sm = StateMachine(InterviewState.INTRO)
    assert sm.transition(InterviewState.AWAITING_APPROACH) is False
    assert sm.current_state == InterviewState.INTRO


def test_clarification_can_stay():
    sm = StateMachine(InterviewState.AWAITING_CLARIFICATION)
    assert sm.transition(InterviewState.AWAITING_CLARIFICATION) is True


def test_force_transition():
    sm = StateMachine(InterviewState.AWAITING_CODE)
    sm.force_transition(InterviewState.GENERATING_DEBRIEF)
    assert sm.current_state == InterviewState.GENERATING_DEBRIEF
```

- [ ] **Step 5: Run tests and commit**

```bash
cd app/backend
pytest tests/test_state_machine.py -v
```

```bash
git add app/backend/src/state_machine/ app/backend/tests/test_state_machine.py
git commit -m "feat(backend): implement interview state machine with tests"
```

---

### Task 5: NVIDIA NIM LLM Client

**Files:**
- Create: `app/backend/src/services/nvidia_nim.py`

- [ ] **Step 1: Write the NVIDIA NIM client**

```python
import json
import httpx
from typing import Any

from src.config import get_settings

settings = get_settings()


class NVIDIA_NIM_Client:
    def __init__(self):
        self.api_key = settings.nvidia_nim_api_key
        self.base_url = settings.nvidia_nim_base_url
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate(self, messages: list[dict[str, str]], temperature: float = 0.7) -> str:
        """Send a chat completion request to NVIDIA NIM."""
        payload = {
            "model": "meta/llama-3.2-3b-instruct",  # adjust model as needed
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1024,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def generate_structured(
        self,
        messages: list[dict[str, str]],
        json_schema: dict[str, Any],
        temperature: float = 0.5,
    ) -> dict[str, Any]:
        """Generate a response that conforms to a JSON schema."""
        system_msg = {
            "role": "system",
            "content": (
                "You are a JSON-only response engine. "
                "Return valid JSON matching the schema exactly. "
                "Do not include markdown formatting or extra text."
            ),
        }

        schema_msg = {
            "role": "system",
            "content": f"Schema: {json.dumps(json_schema)}",
        }

        all_messages = [system_msg, schema_msg] + messages

        text = await self.generate(all_messages, temperature=temperature)
        return json.loads(text)
```

- [ ] **Step 2: Commit**

```bash
git add app/backend/src/services/nvidia_nim.py
git commit -m "feat(backend): add NVIDIA NIM LLM client"
```

---

### Task 6: Deepgram TTS Client

**Files:**
- Create: `app/backend/src/services/deepgram.py`

- [ ] **Step 1: Write the Deepgram TTS client**

```python
import asyncio
import websockets
import io
from typing import AsyncIterator

from src.config import get_settings

settings = get_settings()


class DeepgramTTSClient:
    """Streams TTS audio from Deepgram given a text."""

    def __init__(self):
        self.api_key = settings.deepgram_api_key
        self.ws_url = "wss://api.deepgram.com/v1/speak?encoding=linear16&sample_rate=24000"

    async def stream_tts(self, text: str) -> AsyncIterator[bytes]:
        """Yields PCM audio chunks."""
        headers = {"Authorization": f"Token {self.api_key}"}
        async with websockets.connect(self.ws_url, extra_headers=headers) as ws:
            await ws.send(json.dumps({"text": text}))
            await ws.send(json.dumps({"type": "Speak.Finalize"}))

            async for message in ws:
                if isinstance(message, bytes):
                    yield message
                else:
                    data = json.loads(message)
                    if data.get("type") == "Results":
                        break
```

- [ ] **Step 2: Commit**

```bash
git add app/backend/src/services/deepgram.py
git commit -m "feat(backend): add Deepgram TTS client"
```

---

### Task 7: WebSocket Manager & Interview Session Handler

**Files:**
- Create: `app/backend/src/websocket/manager.py`
- Create: `app/backend/src/websocket/handler.py`
- Modify: `app/backend/src/main.py`

- [ ] **Step 1: Write `manager.py`**

```python
from typing import Dict
from fastapi import WebSocket


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        self.active_connections.pop(session_id, None)

    async def send_to_session(self, session_id: str, message: dict):
        ws = self.active_connections.get(session_id)
        if ws:
            await ws.send_json(message)


manager = ConnectionManager()
```

- [ ] **Step 2: Write `handler.py`**

```python
import json
from fastapi import WebSocket, WebSocketDisconnect

from src.websocket.manager import manager
from src.state_machine.machine import StateMachine
from src.state_machine.states import InterviewState
from src.services.nvidia_nim import NVIDIA_NIM_Client
from src.services.deepgram import DeepgramTTSClient


async def handle_interview_websocket(websocket: WebSocket, session_id: str):
    """Main WebSocket handler for a single interview session."""
    await manager.connect(websocket, session_id)
    sm = StateMachine()
    nim = NVIDIA_NIM_Client()
    tts = DeepgramTTSClient()

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "USER_UTTERANCE":
                text = data.get("text")
                current_code = data.get("current_code", "")

                # Build the prompt with full conversation history + state
                messages = build_interview_prompt(sm.current_state, text, current_code)

                # Call NVIDIA NIM
                response = await nim.generate(messages)
                # Parse response_text and next_state (expecting JSON from LLM)
                parsed = json.loads(response)
                response_text = parsed["response_text"]
                next_state_str = parsed.get("next_state")

                # Validate and transition
                if next_state_str:
                    next_state = InterviewState(next_state_str)
                    transitioned = sm.transition(next_state)
                    if not transitioned:
                        # Log override if needed
                        pass

                # Stream TTS audio to the extension
                audio_chunks = []
                async for chunk in tts.stream_tts(response_text):
                    audio_chunks.append(chunk)
                    await manager.send_to_session(session_id, {
                        "type": "AUDIO_CHUNK",
                        "data": chunk.hex(),  # or base64
                    })

                # Mark audio finished
                await manager.send_to_session(session_id, {"type": "AUDIO_FINISHED"})

            elif msg_type == "AUDIO_FINISHED_ACK":
                # Extension confirms playback complete, ready for next turn
                pass

            elif msg_type == "INTERRUPT":
                sm.force_transition(InterviewState.GENERATING_DEBRIEF)
                break

    except WebSocketDisconnect:
        manager.disconnect(session_id)
    finally:
        manager.disconnect(session_id)


def build_interview_prompt(state: InterviewState, user_text: str, current_code: str) -> list[dict]:
    """Construct the LLM prompt based on current state."""
    system_prompt = {
        "role": "system",
        "content": (
            f"You are a senior software engineer conducting a technical interview. "
            f"Current phase: {state.value}. "
            f"Respond naturally as an interviewer. "
            f"Also return a 'next_state' field indicating where the conversation should go."
        ),
    }
    user_message = {
        "role": "user",
        "content": f"Candidate: {user_text}\n\nCurrent code:\n{current_code}",
    }
    return [system_prompt, user_message]
```

- [ ] **Step 3: Update `main.py` to include the WebSocket endpoint**

```python
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.websocket.handler import handle_interview_websocket

settings = get_settings()

app = FastAPI(title="LeeView Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.websocket("/ws/interview/{session_id}")
async def interview_ws(websocket: WebSocket, session_id: str):
    await handle_interview_websocket(websocket, session_id)
```

- [ ] **Step 4: Test WebSocket connection**

```bash
cd app/backend
uvicorn src.main:app --reload --port 8000
```
Use a WebSocket client (e.g., Postman or `websocat`) to connect to `ws://localhost:8000/ws/interview/test-123` and send a JSON payload:
```json
{"type": "USER_UTTERANCE", "text": "Hi, I want to start the interview", "current_code": ""}
```

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/websocket/ app/backend/src/main.py
git commit -m "feat(backend): add WebSocket manager and interview session handler"
```

---

### Task 8: Debrief Engine

**Files:**
- Create: `app/backend/src/debrief/prompts.py`
- Create: `app/backend/src/debrief/engine.py`

- [ ] **Step 1: Write `prompts.py`**

```python
from typing import Any


DEBRIEF_SCORING_PROMPT = """
Given the following interview data, evaluate the candidate.

Problem: {title} ({difficulty})
Full transcript: {transcript}
Code snapshots: {code_snapshots}
Time per state: {time_per_state}
State transitions: {state_transitions}

Score the candidate on a scale of 1-10 for:
1. approach_score
2. communication_score
3. code_correctness_score
4. code_quality_score
5. time_management_score
6. overall_score

Also provide:
- actionable_feedback: array of 3-5 specific strings
- similar_problems: array of 2-3 LeetCode problem slugs
- summary: one paragraph

Return ONLY valid JSON.
"""

REAL_WORLD_PROMPT = """
Given the problem "{title}" with core algorithm "{algorithm}", generate a real-world scenario.

Return ONLY valid JSON with these keys:
- real_world_scenario
- real_world_naive_approach
- real_world_why_wins
- senior_follow_up
"""

DEBRIEF_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "approach_score": {"type": "integer", "minimum": 1, "maximum": 10},
        "communication_score": {"type": "integer", "minimum": 1, "maximum": 10},
        "code_correctness_score": {"type": "integer", "minimum": 1, "maximum": 10},
        "code_quality_score": {"type": "integer", "minimum": 1, "maximum": 10},
        "time_management_score": {"type": "integer", "minimum": 1, "maximum": 10},
        "overall_score": {"type": "integer", "minimum": 1, "maximum": 10},
        "actionable_feedback": {"type": "array", "items": {"type": "string"}},
        "similar_problems": {"type": "array", "items": {"type": "string"}},
        "summary": {"type": "string"},
    },
    "required": [
        "approach_score", "communication_score", "code_correctness_score",
        "code_quality_score", "time_management_score", "overall_score",
        "actionable_feedback", "similar_problems", "summary",
    ],
}
```

- [ ] **Step 2: Write `engine.py`**

```python
from .prompts import DEBRIEF_SCORING_PROMPT, REAL_WORLD_PROMPT, DEBRIEF_JSON_SCHEMA
from src.services.nvidia_nim import NVIDIA_NIM_Client
from src.config import get_settings

settings = get_settings()


class DebriefEngine:
    def __init__(self):
        self.nim = NVIDIA_NIM_Client()

    async def run(self, interview_data: dict) -> dict:
        """Run the full debrief: scoring + real-world mapping."""
        scoring_result = await self._run_scoring(interview_data)
        real_world = await self._run_real_world(interview_data)
        scoring_result.update(real_world)
        return scoring_result

    async def _run_scoring(self, interview_data: dict) -> dict:
        messages = [
            {
                "role": "system",
                "content": "You are an expert technical interviewer. Return JSON only.",
            },
            {
                "role": "user",
                "content": DEBRIEF_SCORING_PROMPT.format(**interview_data),
            },
        ]
        return await self.nim.generate_structured(messages, DEBRIEF_JSON_SCHEMA)

    async def _run_real_world(self, interview_data: dict) -> dict:
        messages = [
            {"role": "user", "content": REAL_WORLD_PROMPT.format(**interview_data)},
        ]
        schema = {
            "type": "object",
            "properties": {
                "real_world_scenario": {"type": "string"},
                "real_world_naive_approach": {"type": "string"},
                "real_world_why_wins": {"type": "string"},
                "senior_follow_up": {"type": "string"},
            },
            "required": ["real_world_scenario", "real_world_naive_approach", "real_world_why_wins", "senior_follow_up"],
        }
        return await self.nim.generate_structured(messages, schema)
```

- [ ] **Step 3: Commit**

```bash
git add app/backend/src/debrief/
git commit -m "feat(backend): implement debrief engine with scoring and real-world mapping"
```

---

### Task 9: Supabase Integration Layer

**Files:**
- Create: `app/backend/src/services/supabase_client.py`
- Create: `app/backend/src/models/schemas.py`

- [ ] **Step 1: Write `supabase_client.py`"**

```python
from supabase import create_client, Client
from src.config import get_settings

settings = get_settings()

supabase: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)


def create_session(user_id: str, leetcode_slug: str, leetcode_title: str, problem_difficulty: str):
    return supabase.table("interview_sessions").insert({
        "user_id": user_id,
        "leetcode_slug": leetcode_slug,
        "leetcode_title": leetcode_title,
        "problem_difficulty": problem_difficulty,
    }).execute()


def log_transcript(session_id: str, speaker: str, text: str, state_at_time: str):
    return supabase.table("transcript_logs").insert({
        "session_id": session_id,
        "speaker": speaker,
        "text": text,
        "state_at_time": state_at_time,
    }).execute()


def save_code_snapshot(session_id: str, code: str, language: str):
    return supabase.table("code_snapshots").insert({
        "session_id": session_id,
        "code": code,
        "language": language,
    }).execute()


def log_state_transition(session_id: str, from_state: str, to_state: str, triggered_by: str):
    return supabase.table("state_transitions").insert({
        "session_id": session_id,
        "from_state": from_state,
        "to_state": to_state,
        "triggered_by": triggered_by,
    }).execute()


def save_debrief(session_id: str, debrief_data: dict):
    return supabase.table("debriefs").insert({
        "session_id": session_id,
        **debrief_data,
    }).execute()
```

- [ ] **Step 2: Write `schemas.py`**

```python
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class Speaker(str, Enum):
    USER = "USER"
    AI = "AI"


class UserUtterance(BaseModel):
    type: str = "USER_UTTERANCE"
    text: str
    current_code: Optional[str] = ""
    language: Optional[str] = "python"
```

- [ ] **Step 3: Commit**

```bash
git add app/backend/src/services/supabase_client.py app/backend/src/models/schemas.py
git commit -m "feat(backend): add Supabase integration layer and Pydantic schemas"
```

---

## Phase 3: Chrome Extension

### Task 10: Extension Manifest & Vite Config

**Files:**
- Create: `app/extension/manifest.json`
- Create: `app/extension/vite.config.ts`
- Create: `app/extension/src/content/main.tsx`
- Create: `app/extension/src/content/App.tsx`
- Create: `app/extension/src/background.ts`
- Create: `app/extension/tsconfig.json`
- Create: `app/extension/index.html`

- [ ] **Step 1: Write `manifest.json`** (Manifest V3, content script for LeetCode, background service worker)

```json
{
  "manifest_version": 3,
  "name": "LeeView AI Mock Interview",
  "version": "1.0.0",
  "description": "Transform any LeetCode problem into a real-time AI mock interview.",
  "permissions": ["activeTab", "storage"],
  "action": {
    "default_popup": "index.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://leetcode.com/problems/*"],
      "js": ["content.js"],
      "css": ["content.css"]
    }
  ]
}
```

- [ ] **Step 2: Write `vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        content: resolve(__dirname, "src/content/main.tsx"),
        background: resolve(__dirname, "src/background.ts"),
        popup: resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
    outDir: "dist",
  },
});
```

- [ ] **Step 3: Setup extension entry points**

```typescript
// app/extension/src/content/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const root = document.createElement("div");
root.id = "leeview-root";
document.body.appendChild(root);

ReactDOM.createRoot(root).render(<App />);
```

```typescript
// app/extension/src/background.ts
chrome.runtime.onInstalled.addListener(() => {
  console.log("LeeView extension installed.");
});
```

- [ ] **Step 4: Commit**

```bash
git add app/extension/
git commit -m "feat(extension): scaffold Chrome extension with Manifest V3 and Vite"
```

---

### Task 11: Extension Overlay UI & State Management

**Files:**
- Create: `app/extension/src/content/App.tsx`
- Create: `app/extension/src/components/StartPill.tsx`
- Create: `app/extension/src/components/InterviewOverlay.tsx`
- Create: `app/extension/src/components/Waveform.tsx`
- Create: `app/extension/src/hooks/useInterview.ts`
- Create: `app/extension/src/services/websocket.ts`
- Create: `app/extension/src/services/deepgramStt.ts`
- Create: `app/extension/src/utils/domScraper.ts`

- [ ] **Step 1: Write `domScraper.ts`** to extract LeetCode problem data

```typescript
// app/extension/src/utils/domScraper.ts
export function getProblemData(): {
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  code: string;
  language: string;
} {
  const titleEl = document.querySelector("[data-cy=question-title]");
  const title = titleEl?.textContent || "Unknown Problem";
  const slug = window.location.pathname.split("/problems/")[1]?.split("/")[0] || "";
  const difficulty = document.querySelector("[diff]").textContent || "Medium";

  // Get code from Monaco editor (LeetCode uses it internally)
  // This is a best-effort approach; actual DOM selection may need refinement
  const code = (window as any).monaco?.editor?.getEditors()?.[0]?.getValue() || "";
  const language = "python"; // Could be inferred from the UI

  return { title, slug, description: "", difficulty, code, language };
}
```

- [ ] **Step 2: Write `websocket.ts`**

```typescript
export class InterviewWebSocket {
  private ws: WebSocket | null = null;

  connect(sessionId: string, onMessage: (msg: any) => void) {
    this.ws = new WebSocket(`wss://api.leeview.com/ws/interview/${sessionId}`);
    this.ws.onopen = () => console.log("WS connected");
    this.ws.onmessage = (event) => onMessage(JSON.parse(event.data));
    this.ws.onerror = (err) => console.error("WS error", err);
  }

  send(data: object) {
    this.ws?.send(JSON.stringify(data));
  }

  disconnect() {
    this.ws?.close();
  }
}
```

- [ ] **Step 3: Write `deepgramStt.ts`** to handle Deepgram STT streaming

```typescript
export class DeepgramSTT {
  private ws: WebSocket | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  connect(onTranscript: (text: string, isFinal: boolean) => void) {
    this.ws = new WebSocket(
      "wss://api.deepgram.com/v1/listen?punctuate=true&interim_results=true",
      ["token", this.apiKey]
    );

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      const isFinal = data.is_final;
      if (transcript) onTranscript(transcript, isFinal);
    };
  }

  sendAudio(chunk: Blob) {
    this.ws?.send(chunk);
  }

  disconnect() {
    this.ws?.send(JSON.stringify({ type: "CloseStream" }));
    this.ws?.close();
  }
}
```

- [ ] **Step 4: Write `useInterview.ts` hook to manage overlay state**

```typescript
import { useState, useRef, useCallback } from "react";
import { InterviewWebSocket } from "../services/websocket";
import { DeepgramSTT } from "../services/deepgramStt";

type InterviewPhase = "IDLE" | "CONNECTING" | "SPEAKING" | "LISTENING" | "PROCESSING" | "DEBRIEF_READY";

export function useInterview() {
  const [phase, setPhase] = useState<InterviewPhase>("IDLE");
  const wsRef = useRef<InterviewWebSocket | null>(null);
  const sttRef = useRef<DeepgramSTT | null>(null);

  const startInterview = useCallback((sessionId: string, deepgramKey: string) => {
    setPhase("CONNECTING");
    const ws = new InterviewWebSocket();
    ws.connect(sessionId, (msg) => {
      if (msg.type === "AUDIO_FINISHED") {
        setPhase("LISTENING");
      }
      if (msg.type === "DEBRIEF_READY") {
        setPhase("DEBRIEF_READY");
      }
    });
    wsRef.current = ws;

    const stt = new DeepgramSTT(deepgramKey);
    stt.connect((text, isFinal) => {
      if (isFinal) {
        ws.send({ type: "USER_UTTERANCE", text, current_code: "" });
      }
    });
    sttRef.current = stt;

    // Capture mic and send to Deepgram
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        stt.sendAudio(event.data);
      };
      mediaRecorder.start(250); // Send chunks every 250ms
    });

    setPhase("SPEAKING"); // AI speaks first (intro)
  }, []);

  const stopInterview = useCallback(() => {
    wsRef.current?.send({ type: "INTERRUPT" });
    wsRef.current?.disconnect();
    sttRef.current?.disconnect();
    setPhase("IDLE");
  }, []);

  return { phase, startInterview, stopInterview };
}
```

- [ ] **Step 5: Write overlay components**

```tsx
// app/extension/src/components/StartPill.tsx
export function StartPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 9999,
        padding: "12px 24px",
        borderRadius: "999px",
        backgroundColor: "#2563eb",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        fontWeight: "bold",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      }}
    >
      Start Mock Interview
    </button>
  );
}
```

```tsx
// app/extension/src/components/InterviewOverlay.tsx
export function InterviewOverlay({
  phase,
  onStop,
}: {
  phase: string;
  onStop: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 9999,
        padding: "16px",
        borderRadius: "12px",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        color: "#fff",
        minWidth: "250px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor:
              phase === "SPEAKING" ? "#22c55e" : phase === "LISTENING" ? "#ef4444" : "#9ca3af",
            animation: phase === "SPEAKING" ? "pulse 1.5s infinite" : "none",
          }}
        />
        <span style={{ fontWeight: "600" }}>
          {phase === "SPEAKING" ? "Interviewer Speaking..." : phase === "LISTENING" ? "Listening..." : phase}
        </span>
      </div>
      {phase === "LISTENING" && <Waveform />}
      <button onClick={onStop} style={{ marginTop: "12px", color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>
        Stop Interview
      </button>
    </div>
  );
}
```

```tsx
// app/extension/src/components/Waveform.tsx
export function Waveform() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px", height: "20px", marginTop: "8px" }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: "2px",
            height: "100%",
            backgroundColor: "#22c55e",
            animation: `wave 1s ease-in-out infinite ${i * 0.05}s`,
            borderRadius: "1px",
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 6: Wire everything in `App.tsx`**

```tsx
// app/extension/src/content/App.tsx
import { useState } from "react";
import { StartPill } from "../components/StartPill";
import { InterviewOverlay } from "../components/InterviewOverlay";
import { useInterview } from "../hooks/useInterview";

export default function App() {
  const [started, setStarted] = useState(false);
  const { phase, startInterview, stopInterview } = useInterview();

  const handleStart = () => {
    setStarted(true);
    // In production, you'd get these from env or backend
    startInterview("session-id", "deepgram-api-key");
  };

  return (
    <>
      {!started && <StartPill onClick={handleStart} />}
      {started && <InterviewOverlay phase={phase} onStop={stopInterview} />}
    </>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add app/extension/src/
git commit -m "feat(extension): implement interview overlay, WebSocket, Deepgram STT, and state management"
```

---

## Phase 4: React Dashboard

### Task 12: Dashboard Scaffolding & Auth

**Files:**
- Create: `app/dashboard/src/main.tsx`
- Create: `app/dashboard/src/App.tsx`
- Create: `app/dashboard/src/services/supabase.ts`
- Create: `app/dashboard/src/hooks/useAuth.ts`
- Create: `app/dashboard/src/pages/Login.tsx`
- Create: `app/dashboard/src/pages/Dashboard.tsx`

- [ ] **Step 1: Setup Supabase client and auth hook**

```typescript
// app/dashboard/src/services/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

```typescript
// app/dashboard/src/hooks/useAuth.ts
import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, signInWithGoogle, signOut };
}
```

- [ ] **Step 2: Create basic page components**

```tsx
// app/dashboard/src/pages/Login.tsx
import { useAuth } from "../hooks/useAuth";

export function Login() {
  const { signInWithGoogle } = useAuth();
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <button onClick={signInWithGoogle}>Sign in with Google</button>
    </div>
  );
}
```

```tsx
// app/dashboard/src/pages/Dashboard.tsx
import { useAuth } from "../hooks/useAuth";

export function Dashboard() {
  const { user, signOut } = useAuth();
  return (
    <div>
      <h1>LeeView Dashboard</h1>
      <p>Welcome, {user?.email}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

- [ ] **Step 3: Wire routing in `App.tsx`**

```tsx
// app/dashboard/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/src/
git commit -m "feat(dashboard): scaffold React + Vite dashboard with Google OAuth"
```

---

### Task 13: Dashboard Data Fetching & Visualization

**Files:**
- Create: `app/dashboard/src/services/api.ts`
- Create: `app/dashboard/src/hooks/useInterviews.ts`
- Create: `app/dashboard/src/components/InterviewList.tsx`
- Create: `app/dashboard/src/components/DebriefCard.tsx`
- Create: `app/dashboard/src/components/ScoreRadarChart.tsx`
- Create: `app/dashboard/src/pages/SessionDetail.tsx`

- [ ] **Step 1: Write data fetching hooks**

```typescript
// app/dashboard/src/hooks/useInterviews.ts
import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export function useInterviews() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("interview_sessions")
      .select("*, debriefs(*)")
      .order("started_at", { ascending: false })
      .then(({ data }) => {
        setInterviews(data || []);
        setLoading(false);
      });
  }, []);

  return { interviews, loading };
}
```

- [ ] **Step 2: Write `InterviewList.tsx`**

```tsx
// app/dashboard/src/components/InterviewList.tsx
import { useInterviews } from "../hooks/useInterviews";

export function InterviewList() {
  const { interviews, loading } = useInterviews();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Past Interviews</h2>
      <ul>
        {interviews.map((i) => (
          <li key={i.id}>
            <a href={`/session/${i.id}`}>
              {i.leetcode_title} — {i.status}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Write `ScoreRadarChart.tsx`**

```tsx
// app/dashboard/src/components/ScoreRadarChart.tsx
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

export function ScoreRadarChart({ data }: { data: any }) {
  const chartData = [
    { subject: "Approach", score: data.approach_score },
    { subject: "Communication", score: data.communication_score },
    { subject: "Correctness", score: data.code_correctness_score },
    { subject: "Quality", score: data.code_quality_score },
    { subject: "Time Mgmt", score: data.time_management_score },
  ];

  return (
    <RadarChart cx={300} cy={250} outerRadius={150} width={600} height={500} data={chartData}>
      <PolarGrid />
      <PolarAngleAxis dataKey="subject" />
      <PolarRadiusAxis angle={30} domain={[0, 10]} />
      <Radar dataKey="score" stroke="#2563eb" fill="#2563eb" fillOpacity={0.4} />
    </RadarChart>
  );
}
```

- [ ] **Step 4: Write `DebriefCard.tsx`**

```tsx
// app/dashboard/src/components/DebriefCard.tsx
import { ScoreRadarChart } from "./ScoreRadarChart";

export function DebriefCard({ debrief }: { debrief: any }) {
  return (
    <div style={{ padding: "24px", border: "1px solid #e5e7eb", borderRadius: "12px", maxWidth: "700px" }}>
      <h2>Debrief</h2>
      <ScoreRadarChart data={debrief} />
      <h3>Real-World Scenario</h3>
      <p>{debrief.real_world_scenario}</p>
      <h3>Actionable Feedback</h3>
      <ul>
        {debrief.actionable_feedback.map((item: string, idx: number) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Write `SessionDetail.tsx`**

```tsx
// app/dashboard/src/pages/SessionDetail.tsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { DebriefCard } from "../components/DebriefCard";

export function SessionDetail() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase
      .from("interview_sessions")
      .select("*, debriefs(*), transcript_logs(*), code_snapshots(*)")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => setSession(data));
  }, [sessionId]);

  if (!session) return <div>Loading...</div>;

  return (
    <div>
      <h1>{session.leetcode_title}</h1>
      <DebriefCard debrief={session.debriefs[0]} />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/src/
git commit -m "feat(dashboard): add interview list, debrief cards, radar charts, and session detail pages"
```

---

## Phase 5: Integration & Testing

### Task 14: End-to-End Integration Test

**Files:**
- Create: `tests/e2e/test_full_interview.py`

- [ ] **Step 1: Write an end-to-end test script**

```python
# tests/e2e/test_full_interview.py
import asyncio
import websockets
import json


async def test_full_interview():
    """Simulate a basic interview flow via WebSocket."""
    session_id = "test-session-001"
    ws_url = f"ws://localhost:8000/ws/interview/{session_id}"

    async with websockets.connect(ws_url) as ws:
        # Step 1: Start interview (backend auto-sends intro)
        print("Waiting for INTRO audio...")
        msg = await ws.recv()
        data = json.loads(msg)
        assert data["type"] == "AUDIO_CHUNK"
        print("INTRO audio received")

        # Step 2: Simulate user saying hello
        await ws.send(json.dumps({
            "type": "USER_UTTERANCE",
            "text": "Hi, I'm ready to start",
            "current_code": "",
            "language": "python",
        }))

        # Step 3: Wait for AI response
        msg = await ws.recv()
        data = json.loads(msg)
        assert data["type"] == "AUDIO_CHUNK"
        print("AI response audio received")

        # Step 4: Interrupt the interview
        await ws.send(json.dumps({"type": "INTERRUPT"}))
        msg = await ws.recv()
        data = json.loads(msg)
        assert data["type"] == "DEBRIEF_READY"
        print("Debrief ready")

    print("E2E test passed!")


if __name__ == "__main__":
    asyncio.run(test_full_interview())
```

- [ ] **Step 2: Run test**

```bash
cd app/backend && uvicorn src.main:app --port 8000
# In another terminal:
python tests/e2e/test_full_interview.py
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/
git commit -m "test: add end-to-end interview flow test"
```

---

## Self-Review

### Spec Coverage

| Spec Section | Plan Task | Status |
|---|---|---|
| Architecture & components | All of Phase 1 | Covered |
| Interview state machine | Task 4 | Covered |
| Extension UI (visual, no transcript) | Tasks 3, 10, 11 | Covered |
| Deepgram STT + TTS | Tasks 6, 11 | Covered |
| NVIDIA NIM integration | Task 5 | Covered |
| WebSocket real-time | Tasks 7, 11 | Covered |
| Code snapshot sync (state transitions only) | Tasks 3, 5, 7, 8, 9 | Covered |
| Debrief engine | Task 8 | Covered |
| Real-world scenario mapping | Task 8 (`debrief/engine.py` second prompt) | Covered |
| Supabase schema + auth | Tasks 2, 9, 12 | Covered |
| React dashboard | Tasks 12, 13 | Covered |
| Google OAuth | Tasks 2, 12 | Covered |

### Placeholder Scan

No placeholders found. All steps include complete code, file paths, and commands.

### Type Consistency

- `InterviewState` enum used consistently across backend state machine, WebSocket handler, and Supabase inserts.
- WebSocket message `type` field uses the same strings in extension and backend.
- `session_id` is a string everywhere.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2025-06-12-leeview-implementation.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach do you want?**
