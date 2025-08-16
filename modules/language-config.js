const fs = require('fs');
const path = require('path');

const serverLanguages = {
    en: {
        title: "Getty",
        description: "Widget app for tip notifications, tip goals, chat rewards and display real-time alerts for your livestreams in Odysee.",
        chatClaimId: 'Chat Claim ID',
        invalidClaimId: 'Invalid Claim ID',
        announcementAnimationFade: 'Fade',
        announcementAnimationSlideUp: 'Slide Up',
        announcementAnimationSlideLeft: 'Slide Left',
        announcementAnimationScale: 'Scale',
        announcementAnimationRandom: 'Random',
    },
    es: {
        title: "Getty",
        description: "Aplicación de widget para notificaciones de propinas, objetivos de propinas, recompensas de chat y visualización de alertas en tiempo real para tus directos en Odysee.",
        chatClaimId: 'Claim ID del Chat',
        invalidClaimId: 'Claim ID inválido',
        announcementAnimationFade: 'Desvanecer',
        announcementAnimationSlideUp: 'Deslizar Arriba',
        announcementAnimationSlideLeft: 'Deslizar Izquierda',
        announcementAnimationScale: 'Escalar',
        announcementAnimationRandom: 'Aleatorio',
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
