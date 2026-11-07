# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LeeView turns any LeetCode problem page into a live, voice-driven AI mock interview. A Chrome extension injects an overlay on `leetcode.com/problems/*`, streams the candidate's voice to Deepgram for speech-to-text, sends each utterance plus the current editor code to a FastAPI backend over a WebSocket, and plays the interviewer's streamed TTS reply. When the interview ends the backend generates a scored debrief, saved to Supabase and shown in a React dashboard.

## Repository Layout

- `app/extension/` — Chrome extension (Manifest V3, React 19 + TypeScript, Vite). Built into `app/extension/dist/`.
- `app/backend/` — FastAPI orchestrator: interview state machine, LLM calls (NVIDIA NIM / OpenRouter / mock), Deepgram TTS, debrief engine, Supabase writes.
- `app/dashboard/` — React + Vite + Tailwind web app: Google sign-in via Supabase, interview history, session detail, analytics.
- `supabase/migrations/` — SQL schema and RLS policies, applied in order.
- `docs/` — product plan (`saas-plan.md`) and design specs / implementation plans under `docs/superpowers/`.
- `tests/e2e/` — end-to-end interview test (Python).

## Commands

### Extension (`app/extension`)
- `npm run build` — type-checks, then runs four Vite builds (content script, auth bridge, editor bridge, popup + background) into `dist/` and copies `manifest.json`.
- `npm test` — unit tests via `node --experimental-strip-types --test tests/*.test.ts`. Tests only cover pure modules (no Vite env, no DOM).
- Load `app/extension/dist/` (not the source folder) with **Load unpacked** at `chrome://extensions/`; rebuild and click reload after changes.
- Env vars live in `app/extension/.env` (see `.env.example`) and are baked in at build time via Vite `define`.

### Backend (`app/backend`)
- `pip install -e ".[dev]"` then `uvicorn main:app --reload --port 8000` from `app/backend/src`.
- `pytest` (config in `pyproject.toml`, `pythonpath = src`). `LLM_PROVIDER=mock` gives canned replies for offline UI work.

### Dashboard (`app/dashboard`)
- `npm run dev` (port 5173), `npm run build`.

## Extension Architecture

Four separately bundled scripts, wired up in `manifest.json`:

- `content.js` (`src/content/main.tsx`) — IIFE injected on LeetCode problem pages. Mounts the React overlay in an open shadow root, with fonts inlined as data URIs because LeetCode's CSP blocks font fetches. `useInterview.ts` owns the whole voice pipeline: mic → `MediaRecorder` → Deepgram STT (Flux first, Nova-3 fallback, `services/fluxStt.ts` / `deepgramStt.ts`) → backend WebSocket (`services/websocket.ts`) → PCM playback through Web Audio. Every async step checks a generation counter so a reset can't revive a torn-down interview.
- `editorBridge.js` — runs in the page's MAIN world to read `window.monaco` (content scripts can't see it) and answers over `postMessage`. Falls back to LeetCode's IndexedDB, then to visible DOM lines (`utils/domScraper.ts`).
- `authBridge.js` — injected on the dashboard origin. Reads the Supabase session from `localStorage` and relays it to the background service worker.
- `background.js` — MV3 service worker. Stores auth in `chrome.storage.local`, answers `GET_AUTH`, and manages the sign-in / silent-reconnect tab journey in `chrome.storage.session`.

Backend URL and dashboard URL come from `VITE_BACKEND_URL` / `VITE_DASHBOARD_URL` and default to localhost. `manifest.json` host permissions, content-script matches and CSP are also still localhost-only and must change for a production build.

## Known Pre-release Issues

- The Deepgram API key is compiled into `content.js` (`VITE_DEEPGRAM_API_KEY`). It must be replaced by short-lived tokens minted by the backend before any public release.
- `manifest.json` has no `icons` and only localhost dev origins.
