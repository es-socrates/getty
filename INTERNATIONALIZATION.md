#  Getty: Internationalization System

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

- `public/js/languages.js` - Client-side language manager
- `public/index.html` - Main page with translations
- `public/admin.html` - Admin panel with translations
- `public/css/admin.css` - Styles for the user menu
- `public/css/styles.css` - Styles for the user menu

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

1. **Edit `public/js/languages.js`:**
```javascript
const languages = {
    en: {
        // Add new key
        newKey: "English text"
    },
    es: {
        // Add corresponding translation
        newKey: "Texto en español"
    }
};
```

2. **Use in HTML:**
```html
<span data-i18n="newKey">Default text</span>
```

#### Add a New Language

1. **Add language in `public/js/languages.js`:**
```javascript
const languages = {
    en: { /* English translations */ },
    es: { /* Spanish translations */ },
    fr: { /* new French translations */ }
};
```

2. **Add option in the selectors:**
```html
<select class="language-selector">
    <option value="en">English</option>
    <option value="es">Español</option>
    <option value="fr">Français</option>
</select>
```

3. **Update `modules/language-config.js` for the server**

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
   - Make sure `languages.js` is included in the HTML
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
console.log(window.languageManager.currentLanguage);
console.log(window.languageManager.getText('testKey'));
```

## Contributing

To add translations:

1. Fork the repository
2. Add translations in `languages.js`
3. Create a pull request

## License

This internationalization system is under the same MIT license as the main project. 