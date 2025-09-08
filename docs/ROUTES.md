# API Routes Map

This document maps HTTP endpoints to their route modules and main responsibilities. Annotations:

- [RL] rate-limited (via limiter/strictLimiter)
- [Session] may require session in hosted mode or if `GETTY_REQUIRE_SESSION=1`

## Text-to-Speech — `routes/tts.js`

- GET `/api/tts-setting`
- POST `/api/tts-setting` [RL]
- GET `/api/tts-language`
- POST `/api/tts-language` [RL]

## Language — `routes/language.js`

- GET `/api/language`
- POST `/api/language`

## Chat — `routes/chat.js` + controls in `server.js`

- GET `/api/chat-config`
- POST `/api/chat` [RL]
- POST `/api/chat/start` [Session]
- POST `/api/chat/stop` [Session]
- GET `/api/chat/status`
- GET `/api/chat/debug`

## External Notifications — `routes/external-notifications.js`

- GET `/api/external-notifications`
- POST `/api/external-notifications` [RL]
  Live (stream announcement) endpoints:
- POST `/api/external-notifications/live/config` [RL] — Save draft (title, description, imageUrl, channelUrl, signature, discordWebhook override, auto, livePostClaimId)
- GET `/api/external-notifications/live/config` — Gets draft (hides webhook override if hosted)
- POST `/api/external-notifications/live/upload` — Upload image (multipart field `image`) max 2MB 1920x1080
- POST `/api/external-notifications/live/send` [RL] — Send real Live announcement (uses override `discordWebhook` if present in payload or draft, otherwise use global liveDiscordWebhook / Telegram live)
- POST `/api/external-notifications/live/test` [RL] — Send test announcement (prefix `[TEST]` to the title)
- GET `/api/external-notifications/live/og?url=` — Extracts valid OG image from an Odysee URL (filters allowed hosts)
- GET `/api/external-notifications/live/resolve?claimId=` — Resolves claimId to an Odysee web URL
- GET `/api/external-notifications/live/diag` — Auto-live diagnostics (namespace, registration, overrides, claim matching)
- POST `/api/external-notifications/live/clear-override` [RL] — Clears pointwise override (body optional `{ target: "discord"|"all" }`)

## Social Media — `routes/socialmedia.js`

- GET `/api/socialmedia-config`
- POST `/api/socialmedia-config` [RL][Session]

## Audio Settings — `routes/audio-settings.js`

- GET `/api/audio-settings`
- POST `/api/audio-settings` (multipart: audioFile) [RL]
- GET `/api/custom-audio`

## Goal Audio File — `routes/goal-audio.js`

- GET `/api/goal-audio` (ETag/Last-Modified)
- GET `/api/goal-audio-settings`
- DELETE `/api/goal-audio-settings` [RL]
- GET `/api/goal-custom-audio`

## Last Tip — `routes/last-tip.js`

- GET `/api/last-tip`
- GET `/api/last-tip/earnings`
- POST `/api/last-tip` [Session]
- GET `/last-donation`

## Tip Goal — `routes/tip-goal.js`

- GET `/api/tip-goal`
- POST `/api/tip-goal` (multipart optional) [RL]

## Tip Notification GIF — `routes/tip-notification-gif.js`

- GET `/api/tip-notification-gif`
- POST `/api/tip-notification-gif` (multipart image) [RL]
- DELETE `/api/tip-notification-gif` [RL]

## Raffle — `routes/raffle.js`

- GET `/api/raffle/settings`
- POST `/api/raffle/settings`
- GET `/api/raffle/state`
- POST `/api/raffle/start`
- POST `/api/raffle/stop`
- POST `/api/raffle/pause`
- POST `/api/raffle/resume`
- POST `/api/raffle/draw`
- POST `/api/raffle/reset`
- POST `/api/raffle/upload-image` (multipart image)

## OBS — `routes/obs.js`

- GET `/api/obs-ws-config`
- POST `/api/obs-ws-config` [RL]

## Liveviews — `routes/liveviews.js`

- POST `/config/liveviews-config.json` (multipart image) [RL]
- GET `/config/liveviews-config.json`
- POST `/api/save-liveviews-label` [RL]
- GET `/api/liveviews/status` — Odysee proxy with cache and optional RL

## Stream History — `routes/stream-history.js`

- GET `/config/stream-history-config.json`
- POST `/config/stream-history-config.json` [RL]
- POST `/api/stream-history/event` [RL]
- GET `/api/stream-history/summary`
- GET `/api/stream-history/performance`
- POST `/api/stream-history/backfill-current` [RL]
- POST `/api/stream-history/clear` [RL]
- GET `/api/stream-history/export`
- POST `/api/stream-history/import` [RL]
- GET `/api/stream-history/status`

## Announcement — `routes/announcement.js`

- GET `/api/announcement` — config + messages [RL]
- POST `/api/announcement` — settings (cooldownSeconds, theme, colors, animationMode, defaultDurationSeconds, applyAllDurations) [RL]
- POST `/api/announcement/message` — add (multipart optional image: text, linkUrl?, durationSeconds?) [RL]
- PUT `/api/announcement/message/:id` — update text/link/duration, toggle enabled, removeImage flag [RL]
- PUT `/api/announcement/message/:id/image` — replace image [RL]
- DELETE `/api/announcement/message/:id` — delete one [RL]
- DELETE `/api/announcement/messages` — bulk clear with optional `?mode=all|test` [RL]
- GET `/api/announcement/favicon` — fetch & cache site favicon as data URI (requires `?url=`) [RL]

## Session & Import/Export — in `server.js`

- GET `/api/session/status`
- GET `/api/session/new` (alias: `/new-session`) [sets cookies]
- GET `/new-session`
- GET `/api/session/public-token` [Session]
- POST `/api/session/regenerate-public` [Session]
- GET `/api/session/export` [Session in hosted mode]
- POST `/api/session/import` [Session in hosted mode]

## Activity & System — in `server.js`

- GET `/api/activity` — recent logs
- POST `/api/activity/clear` [RL]
- GET `/api/activity/export`
- GET `/api/modules` — module status aggregator (sanitized)
- GET `/api/ar-price` — AR/USD price (cached)
- GET `/api/metrics` — server metrics snapshot
- GET `/api/status` — simple OK summary
- GET `/healthz`
- GET `/readyz`
- GET `/obs/widgets` — JSON with widget URLs + recommended dimensions

## Static, Widgets & Admin — in `server.js`

- GET `/`
- GET `/index.html`
- GET `/welcome`
- GET `/welcome/`
- GET `/obs-help`
- GET `/widgets/announcement`
- GET `/widgets/chat`
- GET `/widgets/giveaway`
- GET `/widgets/last-tip`
- GET `/widgets/liveviews`
- GET `/widgets/persistent-notifications`
- GET `/widgets/socialmedia`
- GET `/widgets/tip-goal`
- GET `/widgets/tip-notification`
- GET `/admin.html`
- GET `/admin.html/`
- GET `/admin/*`
- GET `/admin`

## Test utilities — in `server.js`

- POST `/api/test-tip` [RL]
- POST `/api/test-discord` [RL]
- POST `/api/test-donation`
