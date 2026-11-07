# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

LeeView: a voice mock interview on LeetCode. A Chrome extension (MV3) talks to a FastAPI backend over one WebSocket; a React dashboard handles sign-in, history and the user's API keys. Users bring their own keys (NVIDIA NIM or OpenRouter, plus Deepgram). See README.md for the flow diagram.

## Layout

- `app/extension`: React + Vite, built to `dist/` (`npm run build`), tests with `npm test` (node:test). Load `dist/` unpacked in `chrome://extensions`.
  - `src/content/useInterview.ts`: the interview lifecycle (mic, STT, socket, playback, reconnect).
  - `src/services/sttToken.ts`: fetches a short-lived Deepgram token from the backend. Never put provider keys in the extension `.env`: everything there is bundled.
- `app/dashboard`: React + Vite + Tailwind. `src/components/ApiKeys.tsx` is the BYOK UI.
- `app/backend`: FastAPI in `src/`, run with `uvicorn main:app --app-dir src`. Tests: `pytest -q` from `app/backend`.
  - `services/keys.py`: encrypted per-user key store and key resolution.
  - `services/llm/`: NIM and OpenRouter providers plus `FallbackLLMProvider`.
  - `websocket/handler.py`: interview loop, resume registry (`_LIVE`), input caps.
- `supabase/migrations`: apply in order.

## Rules

- Tests never call real AI or voice APIs. Script provider HTTP with `tests/fakes.py` (`ScriptedAPI`, `FakeSupabase`).
- Provider keys come from `resolve_keys(user_id)`; server keys are used only when `ALLOW_SERVER_KEYS=true`.
- Never log or return a stored key; responses carry masked hints only.
