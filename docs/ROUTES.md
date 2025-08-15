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

- routes/announcement.js
  - GET /api/announcement (fetch config + messages)
  - POST /api/announcement (update settings: cooldownSeconds, theme, colors, animationMode, defaultDurationSeconds, applyAllDurations)
  - POST /api/announcement/message (multipart optional image: text, linkUrl?, durationSeconds?)
  - PUT /api/announcement/message/:id (update text/link/duration, toggle enabled, removeImage flag)
  - PUT /api/announcement/message/:id/image (replace image + optional fields)
  - DELETE /api/announcement/message/:id (delete single message)
  - DELETE /api/announcement/messages?mode=all|test (bulk clear all or test/demo messages)
  - GET /api/announcement/favicon?url=... (fetch & cache site favicon as data URI)

Server-wide extras
- /api/modules — module status aggregator (sanitized)
- /api/ar-price — AR/USD price with cache
- /healthz, /readyz — health endpoints
- /obs/widgets — JSON with widget URLs + recommended dimensions
- /api/test-tip, /api/test-donation, /api/test-discord — test utilities

# Notes

- All POST endpoints are rate-limited by strictLimiter in server.js unless noted.
- Some endpoints broadcast events over WebSocket (e.g., goal updates, raffle events, audio settings).
- Announcement endpoints use custom per-scope rate limits (config/message/favicon) defined in server.js.
- WebSocket broadcasts types: init, announcement_config, announcement, tip, donation, raffle events.
