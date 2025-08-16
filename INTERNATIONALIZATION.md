#  Getty: Internationalization System (Unified JSON + Runtime)

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
- `public/js/min/i18n-runtime.js` - Generated bundle for landing & widgets
- `public/index.html` - Main page including runtime script
- `/admin` (SPA) - Vue app using the same JSON (merged with admin extras)
- `public/css/admin.css` / `public/css/styles.css` - Styles for user menu

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
3. Add `<option value="<lang>">` to the language selector in `src/index.html` (and any widget if needed).
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

### POST /api/language
Changes the server language.

**Body:**
```json
{
  "language": "es"
}
```

**Response:**
```json
{
  "success": true,
  "language": "es"
}
```

## Persistence

- **Client:** `localStorage.getItem('getty-language')`
- **Server:** `language-settings.json`

The system keeps both storages synchronized.

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
// In the browser console
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