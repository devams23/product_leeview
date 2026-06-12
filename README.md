# LeeView — AI Mock Interview (Chrome Extension + Dashboard)

Turn any LeetCode problem into a real-time AI mock interview. The extension injects a glassmorphism overlay onto LeetCode, captures voice via Deepgram STT, streams to a FastAPI backend that orchestrates an interview state machine backed by NVIDIA NIM, and streams TTS audio back. Interview data persists in Supabase. A separate React + Vite dashboard provides Google OAuth login and debrief visualization.

---

## Prerequisites

- **Python 3.11+** and `pip`
- **Node.js 18+** and `npm`
- **Chrome** (for loading the unpacked extension)
- **Accounts** (all free tiers work):
  - [Supabase](https://supabase.com) — database + auth
  - [Deepgram](https://deepgram.com) — speech-to-text + text-to-speech
  - [NVIDIA NIM](https://build.nvidia.com) — LLM API

---

## 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public key` → `SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`
3. Go to **Authentication → Providers** and enable **Google**:
   - Configure OAuth with `http://localhost:5173` as the redirect URL
4. Go to **SQL Editor** and run the migrations **in order**:

   ```sql
   -- 1. Tables
   -- Run supabase/migrations/001_initial_schema.sql

   -- 2. RLS policies
   -- Run supabase/migrations/002_rls_policies.sql

   -- 3. RLS fix (backend inserts)
   -- Run supabase/migrations/003_fix_rls.sql
   ```

5. Go to **Authentication → Users** to see user IDs after someone logs in.

### ⚠️ Critical: service_role vs anon key

In **Project Settings → API** you'll see two keys. **Do not confuse them:**

| Key | Starts with | Used by | Bypasses RLS? |
|-----|------------|---------|---------------|
| `anon public` | `eyJ` (shorter) | Dashboard (frontend) | ❌ No |
| `service_role` | `eyJ` (much longer, ~400 chars) | **Backend** | ✅ Yes |

The backend's `.env` needs the **service_role** key for `SUPABASE_SERVICE_ROLE_KEY`. If you put the anon key here, inserts fail with `new row violates row-level security policy`.

---

## 2. Backend (FastAPI)

### 2.1 Environment

```bash
cd app/backend
cp .env.example .env
```

Edit `.env` and fill in your keys (see the warning above about service_role vs anon):

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role_key  ← NOT the anon key!
SUPABASE_ANON_KEY=eyJ...anon_key

DEEPGRAM_API_KEY=dg_xxx
NVIDIA_NIM_API_KEY=nvapi-xxx
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
```

### 2.2 Install & Run

```bash
cd app/backend
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

pip install -e ".[dev]"
uvicorn src.main:app --reload --port 8000
```

Verify: `http://localhost:8000/health` → `{"status": "ok"}`

### 2.3 Run Tests

```bash
cd app/backend
python -m pytest tests/ -v
```

---

## 3. Dashboard (React + Vite)

### 3.1 Environment

```bash
cd app/dashboard
cp .env.example .env
# or create .env with:
echo "VITE_SUPABASE_URL=https://xxxx.supabase.co" > .env
echo "VITE_SUPABASE_ANON_KEY=eyJxxx" >> .env
```

Use the same Supabase URL and **anon key** from step 1.

### 3.2 Install & Run

```bash
cd app/dashboard
npm install
npm run dev
```

Opens at `http://localhost:5173`.

### 3.3 Login Flow

1. Open `http://localhost:5173` in your browser
2. Click **Sign in with Google**
3. After login, your user info is displayed

The extension will auto-detect this login — no need to copy anything.

---

## 4. Chrome Extension (Manifest V3)

### 4.1 Install

```bash
cd app/extension
npm install
npm run build      # produces app/extension/dist/
```

### 4.2 Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select `app/extension/dist/`
5. The extension appears in your toolbar

### 4.3 Authenticate (auto — no manual steps)

The extension injects an **auth bridge** content script on the dashboard domain (`http://localhost:5173`). When you log in via Google OAuth, Supabase stores the session in `localStorage`. The auth bridge reads it and sends your `user_id` + `email` to the extension's background script, which persists it in `chrome.storage`.

**The flow is seamless:**
1. Open the dashboard at `http://localhost:5173` and sign in with Google
2. Click the LeeView icon in the toolbar → popup shows "✓ Signed in" with your email
3. Navigate to any LeetCode problem — the overlay is ready to go

No manual ID entry, no copy-pasting. Just login once and the extension picks it up.

### 4.4 Run an Interview

1. Navigate to any LeetCode problem, e.g. `https://leetcode.com/problems/two-sum/`
2. A **Start Mock Interview** pill appears in the bottom-right corner
3. Click it — the overlay appears and the interview begins
4. Click **End Interview** to stop

---

## 5. End-to-End Flow Summary

```
User opens LeetCode problem
        │
        ▼
Extension injects overlay + StartPill
        │
        ▼
User clicks "Start Mock Interview"
        │
        ▼
Extension reads userId from chrome.storage
        │
        ▼
Extension calls POST /sessions → creates row in interview_sessions (Supabase)
        │
        ▼
Extension opens WebSocket ws://localhost:8000/ws/interview/{session_id}
        │
        ▼
Backend intro audio plays → user speaks → Deepgram STT → NVIDIA NIM → Deepgram TTS
        │
        ▼
Interview cycles through state machine:
  INTRO → AWAITING_CLARIFICATION → AWAITING_APPROACH → AWAITING_CODE
  → AWAITING_WALKTHROUGH → CONCLUDING → GENERATING_DEBRIEF → COMPLETED
        │
        ▼
User reviews debrief on dashboard at http://localhost:5173
```

---

## Project Structure

```
leeview/
├── app/
│   ├── extension/          # Chrome extension (Manifest V3 + React + Vite)
│   ├── backend/             # FastAPI backend (Python)
│   └── dashboard/           # React + Vite dashboard
├── supabase/migrations/     # SQL migrations
├── tests/e2e/               # End-to-end test
└── docs/superpowers/        # Plan + design spec
```

### Key Files

| File | Purpose |
|------|---------|
| `app/backend/src/main.py` | FastAPI app: health, session creation, WebSocket endpoint |
| `app/backend/src/state_machine/` | Interview state machine (8 states, transitions) |
| `app/backend/src/services/nvidia_nim.py` | NVIDIA NIM LLM client |
| `app/backend/src/services/deepgram.py` | Deepgram TTS (server-side streaming) |
| `app/extension/src/content/` | Content script injected into LeetCode |
| `app/extension/src/hooks/useInterview.ts` | Orchestrates WS + STT + state lifecycle |
| `app/dashboard/src/pages/Login.tsx` | Google OAuth + displays User ID |

### Design System

See `docs/superpowers/specs/2025-06-12-leeview-design-system.md` for the glassmorphism tokens (colors, typography, spacing, component specs).
