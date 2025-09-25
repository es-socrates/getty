# API Routes Map

This document provides basic information about public API endpoints for integration purposes.

## Public Widgets

The following widget URLs are available for embedding:

- `/widgets/announcement` - Announcement display widget
- `/widgets/chat` - Chat widget
- `/widgets/giveaway` - Raffle/giveaway widget
- `/widgets/last-tip` - Last donation display widget
- `/widgets/achievements` - Achievement notifications widget
- `/widgets/liveviews` - Live stream viewer count widget
- `/widgets/persistent-notifications` - Persistent notification widget
- `/widgets/socialmedia` - Social media links widget
- `/widgets/tip-goal` - Tip goal progress widget
- `/widgets/tip-notification` - Tip notification widget

## Public API Endpoints

### Stream Status & Information

- `GET /api/modules` - Get module status information (requires `widgetToken` query parameter or `public=1` for sanitized landing payload)
- `GET /api/ar-price` - Get AR/USD exchange rate
- `GET /api/status` - Basic server status check
- `GET /healthz` - Health check endpoint
- `GET /readyz` - Readiness check endpoint

### OBS Integration

- `GET /obs/widgets` - Get widget URLs and recommended dimensions for OBS

- `GET /user/:widgetToken` - Authenticated dashboard view (redirect target after login)

### Static Pages

- `GET /` - Landing page (redirects to `/welcome` for first-time visitors)
- `GET /index.html` - Main page (alias)
- `GET /welcome` - Welcome and login helper
- `GET /obs-help` - OBS integration help page

## Integration Notes

- All endpoints support CORS for web integration
- Rate limiting may apply to prevent abuse
- Some features may require proper session/authentication
- Endpoints may change without notice - check the application for current availability

## Development

For full API documentation and development integration, please contact the maintainers privately.

**Note:** This is a public-safe version of the API documentation. Internal documentation with complete route details is available in `ROUTES_INTERNAL.md` (not included in public repository).
