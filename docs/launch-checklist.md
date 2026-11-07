# Launch checklist

## Must do before launch

- [ ] **Rotate the Deepgram key.** Older extension builds baked it into `dist/content.js`, so treat it as public. Create a new key in the Deepgram console, delete the old one, and rebuild the extension from this branch.
- [ ] **Backend env:** set `KEY_ENCRYPTION_KEY` (and back it up: losing it makes saved keys unreadable), `ALLOW_SERVER_KEYS=false`, `SUPABASE_JWT_SECRET`, and `CORS_ORIGINS` to the real dashboard origin plus `https://leetcode.com` (not `*`).
- [ ] **Apply migration** `supabase/migrations/010_user_api_keys.sql` to the production project.
- [ ] **Production URLs in the extension:** set `VITE_BACKEND_URL` / `VITE_DASHBOARD_URL`, and replace the `localhost` entries in `manifest.json` (`host_permissions`, the auth-bridge `matches`, and the CSP `connect-src`) with the production origins.
- [ ] **Supabase auth:** add the production dashboard URL to the Google OAuth redirect URLs.
- [ ] **Chrome Web Store:** icons (16/48/128), screenshots, a privacy policy (microphone audio goes to Deepgram with the user's key, and transcripts, code and debriefs are stored in Supabase), and a justification for the mic and host permissions.
- [ ] **Hosting:** run the backend as a single instance, or use sticky sessions. Resume within the 45-second grace window relies on in-process state, and after a restart sessions are rebuilt from Supabase.

## Should do soon after

- [ ] **Rate limiting** on `/sessions`, `/stt/token` and `/me/keys` (per user), so a leaked JWT cannot spin up endless sessions.
- [ ] **Move the JWT out of the WebSocket URL** (it is in the query string today; logs redact it). For example, send it as the first message, or use a one-time ticket from a REST call.
- [ ] **Key check on save:** make one cheap test call when a key is saved, so a typo shows up on the profile rather than when the interview starts.
- [ ] Error reporting (Sentry or similar) for the backend and extension.
- [ ] Split the dashboard bundle (Vite warns that it is over 500 kB).

## Done on this branch

- Bring your own keys: encrypted store, profile UI, and keys are required before the mic opens.
- NVIDIA NIM to OpenRouter fallback with a cooldown.
- The Deepgram key no longer ships in the extension; it uses short-lived tokens minted by the backend.
- Interviews resume after a dropped socket or a server restart.
- Input caps (utterance 4k characters, code 50k) and a 40-message prompt window, so long sessions stay bounded.
- Hardening: the extension accepts auth only from the dashboard origin and validates messages; CORS runs without credentials; Supabase CLI link files are no longer tracked.
- Offline tests that simulate full interviews.
