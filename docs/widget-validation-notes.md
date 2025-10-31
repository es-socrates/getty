# OBS Widget Validation Notes

## Setup Checklist

- Ensure the backend server is running on `http://localhost:3000`.
- Build the frontend (`pnpm frontend:build`) and sync assets into `public/` (`pnpm sync:frontend`).
- Always include `?widgetToken=<TOKEN>` (and legacy `token` if needed) on widget URLs so authenticated websocket and REST calls succeed.
- For audio/TTS checks, toggle `debugAudio=1` in the query string to display the overlay volume indicator when required.

## Validation Matrix

| Widget           | Test URL                                                             | API & WS touchpoints                                                                                                                                                 | Token(s) used | Result       | Notes                                                                                          |
| ---------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| tip-notification | `http://localhost:3000/widgets/tip-notification?widgetToken=<TOKEN>` | `GET /api/tip-notification`, `GET /api/tip-notification-gif`, `GET /api/audio-settings`, `GET /api/tts-setting`, websocket `ws://localhost:3000?widgetToken=<TOKEN>` | `<TOKEN>`     | ✅ No issues | Loaded in OBS/browser without CSP/SRI errors; audio + TTS ready for further manual cue checks. |
| tip-goal         | `http://localhost:3000/widgets/tip-goal?widgetToken=<TOKEN>`         | `GET /api/modules/tip-goal`, `GET /api/goal-audio-settings`, websocket `ws://localhost:3000?widgetToken=<TOKEN>`                                                     | `<TOKEN>`     | ⏳ Pending   | Execute live validation next (celebration reset, audio playback, goal progress).               |

## Next Actions

1. Run the tip-goal validation pass and populate the table with observations.
2. Continue migrating/validating remaining widgets, appending each to the matrix with their specific endpoints and outcomes.
3. Once all widgets are verified, fold highlights into `README.md` / `CONTRIBUTING.md` as part of the final clean-up step.

## Widget-Specific Checklists

### Tip Notification

- Launch the widget: `http://localhost:3000/widgets/tip-notification?widgetToken=<TOKEN>&debugAudio=1`.
- Confirm CSP/SRI status in devtools (`Security` tab) and absence of blocked resource logs.
- Trigger a test tip via dashboard or broadcaster console (or emit a manual WS payload using `wscat --connect ws://localhost:3000?widgetToken=<TOKEN>` with `{ "type": "tipNotification", "data": { ... } }`).
- Observe animation, avatar fallback, amount formatting in AR/USD, and GIF placement.
- Validate audio playback (remote/custom) alongside TTS; adjust volume in settings API and ensure live update broadcasts propagate.

### Tip Goal

- Launch the widget: `http://localhost:3000/widgets/tip-goal?widgetToken=<TOKEN>`.
- Review WebSocket connection logs for fallback port attempts in dev mode.
- Use the admin dashboard to fire a “test tip” that increments the goal, or publish a synthetic message to the WS `{ "type": "tipGoalUpdate", ... }`.
- Ensure celebration animation, timeout reset, and progress persistence behave as in legacy overlay.
- Toggle goal audio settings (remote/custom/muted) and confirm volume + source changes are picked up in real time.
- Optional websocket script (replace placeholders):

```bash
wscat --connect ws://localhost:3000?widgetToken=<TOKEN> \
	--execute '{
		"type": "tipGoalUpdate",
		"data": {
			"goalId": "demo-goal",
			"current": 42,
			"target": 100,
			"message": "Synthetic goal progress demo"
		}
	}'
```
