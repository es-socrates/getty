# API Routes Map

This document maps HTTP endpoints to their route modules and main responsibilities.

- routes/tts.js
  - GET /api/tts-setting
  - POST /api/tts-setting
  - GET /api/tts-language
  - POST /api/tts-language

- routes/language.js
  - GET /api/language
  - POST /api/language

- routes/chat.js
  - GET /api/chat-config
  - POST /api/chat

- routes/external-notifications.js
  - GET /api/external-notifications
  - POST /api/external-notifications

- routes/audio-settings.js
  - GET /api/audio-settings
  - POST /api/audio-settings (multipart mp3)
  - GET /api/custom-audio

- routes/goal-audio.js
  - GET /api/goal-audio (ETag/Last-Modified)
  - GET /api/goal-audio-settings
  - DELETE /api/goal-audio-settings
  - GET /api/goal-custom-audio

- routes/last-tip.js
  - POST /api/last-tip
  - GET /last-donation

- routes/tip-goal.js
  - POST /api/tip-goal (multipart optional)

- routes/raffle.js
  - GET /api/raffle/settings
  - POST /api/raffle/settings
  - GET /api/raffle/state
  - POST /api/raffle/start
  - POST /api/raffle/stop
  - POST /api/raffle/pause
  - POST /api/raffle/resume
  - POST /api/raffle/draw
  - POST /api/raffle/reset
  - POST /api/raffle/upload-image (multipart image)

- routes/obs.js
  - GET /api/obs-ws-config
  - POST /api/obs-ws-config

- routes/liveviews.js
  - POST /config/liveviews-config.json (multipart image)
  - GET /config/liveviews-config.json
  - POST /api/save-liveviews-label

Server-wide extras
- /api/modules — module status aggregator (sanitized)
- /api/ar-price — AR/USD price with cache
- /healthz, /readyz — health endpoints

# Notes

- All POST endpoints are rate-limited by strictLimiter in server.js unless noted.
- Some endpoints broadcast events over WebSocket (e.g., goal updates, raffle events, audio settings).
