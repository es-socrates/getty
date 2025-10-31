# Getty: Internationalization System (Unified JSON + Runtime)

This document describes the internationalization system implemented in Getty to support multiple languages.

## Features

- ✅ Support for English (en) and Spanish (es)
- ✅ Real-time language switching
- ✅ User language preference persistence
- ✅ Client-server language synchronization
- ✅ User menu with language selector
- ✅ Complete translations for all interfaces

## Main Files

### Client (Frontend)

- `shared-i18n/*.json` - Source locale files (authoritative translations)
- `scripts/build-i18n.js` - Validation + runtime generator
- `public/js/min/i18n-runtime.js` - Generated readable bundle for landing & widgets (versioned)
- `public/js/min/i18n-runtime.min.js` - Minified variant (optional use)
- `public/index.html` - Main page including runtime script
- `/admin` (SPA) - Vue app using the same JSON (merged with admin extras)
- `public/css/styles.css` - Legacy styles for user menu (kept for backward-compatibility; file is currently deprecated)

### Server (Backend)

- `modules/language-config.js` - Server-side language configuration
- `server.js` - API routes for language management
- `language-settings.json` - Language settings file (created automatically)

## Usage

### For Users

1. **Change language from the user menu:**

   - Click the user icon in the top right corner
   - Select the desired language from the dropdown
   - The change is applied immediately

2. **Access from admin:**
   - Go to the admin page
   - Use the user menu to change the language
   - The language remains synchronized across all pages

### For Developers

#### Add New Translations

1. Edit each locale file in `shared-i18n/` (e.g. add `"newKey": "English text"` to `en.json` and its translation to `es.json`).
2. Run `npm run build:i18n` (fails if keys mismatch).
3. Use in HTML / Vue: `<span data-i18n="newKey"></span>` or in Vue components `$t('newKey')`.

#### Add a New Language

1. Copy `shared-i18n/en.json` to `shared-i18n/<lang>.json` and translate values.
2. Run `npm run build:i18n` (validator enforces identical key sets).
3. Add `<option value="<lang>">` to the language selectors in the Vue pages (for example `frontend/src/pages/landing/App.vue` and `frontend/src/pages/welcome/App.vue`, plus any widgets that expose language controls).
4. Optionally update server accepted locales if you restrict them (`modules/language-config.js`).

## Translation Structure

### Translation Categories

- **Navigation** - Navigation links
- **System Status** - System status
- **Settings** - Widget settings
- **External Services** - External services
- **Messages** - System messages
- **Home page** - Main page elements

### Translation Keys

Keys follow a descriptive pattern:

- `goToHome` - "Go to home"
- `systemStatus` - "System Status"
- `lastTipSettings` - "Last Tip Settings"
- `saveSettings` - "Save Settings"

## Server API

### GET /api/language

Gets the current language setting.

**Response:**

```json
{
  "currentLanguage": "es",
  "availableLanguages": ["en", "es"]
}
```

### POST /api/language (Admin-only network mutation)

Persists a new language on the server (writes `language-settings.json`).

Important behavioral changes:

- Only executed from authenticated admin pages. Public/landing pages now change language locally without sending this request.
- When CSRF protection is enabled the client runtime fetches a token from `/api/admin/csrf` (lazy) and includes it via header `x-csrf-token` (override with env `GETTY_CSRF_HEADER` / `VITE_GETTY_CSRF_HEADER`).
- If the POST returns 401/403 the runtime re-fetches a token once and retries.
- Reduces attack surface and unnecessary network chatter for unauthenticated visitors.

**Body:**

```json
{
  "language": "es"
}
```

**Success Response:**

```json
{
  "success": true,
  "language": "es"
}
```

**Error Examples:**

```jsonc
{ "error": "invalid_language" }
{ "error": "session_required" }
{ "error": "missing_csrf" }
{ "error": "save_failed" }
```

## Persistence & Sync Model

| Context            | Network POST?           | Persistence                             |
| ------------------ | ----------------------- | --------------------------------------- |
| Public / non-admin | No                      | localStorage only                       |
| Admin              | Yes (with CSRF/session) | localStorage + `language-settings.json` |

Public pages no longer attempt server mutation; admin pages keep server + client in sync.

The build script (`scripts/build-i18n.js`) now also emits a minified runtime and injects a version query `?v=<hash>` in HTML to ensure cache busting.

## CSS Styles

User menu styles are defined in:

- `.language-selector` - Language selector
- `#user-menu` - Dropdown menu
- `#user-menu-button` - Menu button

## Compatibility

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Responsive design
- ✅ Basic accessibility (keyboard, screen readers)
- ✅ Fallback to English if translation is missing

## Runtime Generation & Versioning

`scripts/build-i18n.js` steps:

1. Validate locale key parity.
2. Compute hash (first 8 chars of SHA-256 of locales JSON).
3. Emit `i18n-runtime.js` (readable) and `i18n-runtime.min.js` (minified best-effort).
4. Rewrite HTML references to append `?v=<hash>`.

Use the readable file while debugging; widgets can opt into the minified one.

## Troubleshooting

### Common Issues

1. **Translations do not load:**

- Make sure `i18n-runtime.js` is included in the HTML
- Check the browser console for errors

2. **Language does not persist:**

   - Check localStorage permissions
   - Ensure API routes are working

3. **Client-server synchronization fails:**
   - Check network connectivity
   - Review server logs

### Debug

To debug the language system:

```javascript
console.log(window.__i18n.current); // current lang
console.log(window.__i18n.t('testKey')); // translation or key fallback
```

## Contributing

To add translations:

1. Fork the repository
2. Add translations in JSON locale files
3. Create a pull request

## License

This internationalization system is under the same MIT license as the main project.
