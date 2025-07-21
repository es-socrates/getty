const fs = require('fs');
const path = require('path');

const serverLanguages = {
    en: {
        title: "Getty",
        description: "App widget for Odysee streamers to manage tips, goals, and chat.",
    },
    es: {
        title: "Getty",
        description: "Aplicación de widgetds para streamers de Odysee para gestionar propinas, metas y chat.",
    }
};

class LanguageConfig {
    constructor() {
        this.configFile = path.join(__dirname, '../language-settings.json');
        this.defaultLanguage = 'en';
    }

    getLanguage() {
        try {
            if (fs.existsSync(this.configFile)) {
                const settings = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                return settings.language || this.defaultLanguage;
            }
        } catch (error) {
            console.error('Error loading language settings:', error);
        }
        return this.defaultLanguage;
    }

    setLanguage(language) {
        try {
            const settings = { language };
            fs.writeFileSync(this.configFile, JSON.stringify(settings, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving language settings:', error);
            return false;
        }
    }

    getText(key, language = null) {
        const lang = language || this.getLanguage();
        return serverLanguages[lang]?.[key] || serverLanguages[this.defaultLanguage][key] || key;
    }

    getAvailableLanguages() {
        return Object.keys(serverLanguages);
    }
}

module.exports = LanguageConfig; 