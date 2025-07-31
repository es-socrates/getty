const languages = {
    en: {
        title: "Getty",
        adminTitle: "Getty Admin",
        description: "Widget app for tip notifications, tip goals, chat rewards and display real-time alerts for your livestreams in Odysee.",
        goToHome: "Homepage",
        goToAdmin: "Go to admin",
        settings: "Settings",
        language: "Language",
        systemStatus: "System Status",
        lastTip: "Last Tip",
        notifications: "Notifications",
        tipGoal: "Tip Goal",
        chat: "Chat",
        active: "Active",
        inactive: "Inactive",
        updateStatus: "Update Status",
        lastTipSettings: "Last Tip Settings",
        arWalletAddress: "AR Wallet Address:",
        saveSettings: "Save Settings",
        obsIntegration: "OBS Integration",
        lastTipWidgetUrl: "Last Tip Widget URL:",
        copy: "Copy",
        tipGoalSettings: "Tip Goal Settings",
        monthlyGoal: "Monthly Goal (AR):",
        initialAmount: "Initial Amount (AR):",
        lastTip: "Last Tip",
        tipWidget: "Tip Widget",
        refresh: "Refresh",
        connectionStatus: "Connection Status",
        notificationSettings: "Notification Settings",
        notificationWidgetUrl: "Notification Widget URL:",
        enableTextToSpeech: "Enable Text-to-Speech",
        ttsLanguage: "TTS Language:",
        english: "English",
        spanish: "Español",
        ttsHint: "Enable or disable text-to-speech for tip notifications",
        liveChatSettings: "Live Chat Settings",
        chatUrl: "Chat URL:",
        chatWidgetUrl: "Chat Widget URL:",
        externalServices: "External Services",
        externalNotifications: "External Notifications",
        discordWebhook: "Discord Webhook URL:",
        telegramBotToken: "Telegram Bot Token:",
        telegramChatId: "Telegram Chat ID:",
        notificationTemplate: "Notification Template:",
        templateVarsHint: "Available variables: {from}, {amount}, {usd}, {message}",
        copyright: "© 2025 <a href='https://getty.sh/' target='_blank'>Getty</a> - <a href='https://opensource.org/licenses/MIT' target='_blank'>MIT License</a>",
        independentProject: "Made with love for Odysee ❤️",
        lastTipTitle: "Last tip",
        monthlyGoalTitle: "Monthly Goal",
        notificationsTitle: "Notifications",
        liveChatTitle: "Live Chat",
        loading: "Loading...",
        connectingToWallet: "Connecting to the wallet...",
        urlCopied: "URL copied to clipboard!",
        failedToCopy: "Failed to copy!",
        connected: "Connected",
        disconnected: "Disconnected",
        colorCustomizationTitle: "Widget color customization for OBS",
        colorBg: "Background",
        colorFont: "Font",
        colorBorder: "Border",
        colorProgress: "Progress bar",
        colorAmount: "Amount",
        colorIcon: "Icon",
        colorFrom: "Sender",
        colorMsg: "Message background",
        colorMsgAlt: "Alt message background",
        colorDonation: "Tip text",
        colorDonationBg: "Tip background",
        colorUsername: "Username",
        colorUsernameBg: "Username background",
        resetColors: "Reset to default colors",
        colorMsgBg: "Background Message",
        colorMsgAltBg: "Background Message alt",
        colorMsgBorder: "Border Message",
        colorMsgText: "Main text",
        colorMsgUsername: "Username",
        colorMsgUsernameBg: "User background",
        colorMsgDonation: "Tip text",
        colorMsgDonationBg: "Background Tip",
        chatWidgetUrlHorizontal: "Chat Widget URL (Horizontal)",
        chatWidgetUrlHorizontalHelp: "Same widget, but in landscape mode. Use this URL if you want messages to display from right to left.",
        customAudioTitle: "Custom Audio",
        useRemoteAudio: "Use remote audio",
        useCustomAudio: "Use custom audio",
        removeAudio: "Remove audio",
        audioHint: "The custom audio will be played when a new tip is coming in. If you do not select one, the default audio will be used.",
        remoteAudioDescription: "Use remote audio for tip notifications",
        customAudioDescription: "Use custom audio for tip notifications",
        uploadAudioTitle: "Upload Audio",
        uploadAudioInstructions: "Upload an audio file to use as a custom audio for tip notifications",
        uploadAudioRequirements: "Audio file must be less than 1MB and in MP3 format",
        play: "Play",
        remove: "Remove",
        goalAudioTitle: "Goal Audio",
        raffleTitle: "Giveaway",
        raffleCommandLabel: "Giveaway Command:",
        raffleWinnerTitle: "We have a winner!",
        rafflePrizeLabel: "Prize:",
        rafflePrizePlaceholder: "Prize name or description",
        rafflePrizeImageLabel: "Prize Image",
        raffleStatusLabel: "Status:",
        raffleInactive: "Inactive",
        raffleStart: "Start",
        rafflePause: "Pause",
        raffleResume: "Resume",
        raffleStop: "Stop",
        raffleResetWinners: "Clean everything",
        raffleDrawWinner: "Choose the winner",
        raffleMaxWinnersLabel: "Max Winners",
        raffleMaxWinnersPlaceholder: "Enter max winners",
        raffleEnabled: "Enabled",
        raffleCurrentParticipants: "Current Participants",
        raffleWidgetUrlLabel: "Giveaway Widget URL:",
        raffleWidgetObsHelp: "Use this URL in OBS to add the giveaway widget to your stream.",
        raffleAdminSectionTitle: "Giveaway Admin Section",
        raffleAdminSectionDesc: "Manage your giveaways, choose winners, and view participants.",
        raffleAdminSectionWidgetLink: "Widget for OBS Integration:",
        raffleInactive: "The draw is inactive or not configured.",
        raffleParticipants: "participants",
        raffleLoading: "Loading...",
        raffleCommand: "Command:",
        raffleWinners: "Winners:",
    },
    
    es: {
        title: "Getty",
        adminTitle: "Getty Admin",
        description: "Aplicación de widget para notificaciones de propinas, objetivos de propinas, recompensas de chat y visualización de alertas en tiempo real para tus directos en Odysee.",
        goToHome: "Ir al inicio",
        goToAdmin: "Ir al admin",
        settings: "Configuración",
        language: "Idioma",
        systemStatus: "Estado del Sistema",
        lastTip: "Última Propina",
        notifications: "Notificaciones",
        tipGoal: "Meta de Propinas",
        chat: "Chat",
        active: "Activo",
        inactive: "Inactivo",
        updateStatus: "Actualizar Estado",
        lastTipSettings: "Configuración de Última Propina",
        arWalletAddress: "Dirección de Cartera AR:",
        saveSettings: "Guardar Configuración",
        obsIntegration: "Integración OBS",
        lastTipWidgetUrl: "URL del Widget de Última Propina:",
        copy: "Copiar",
        tipGoalSettings: "Configuración de Meta de Propinas",
        monthlyGoal: "Meta Mensual (AR):",
        lastTip: "Última Propina",
        tipWidget: "Widget de Propinas",
        refresh: "Actualizar",
        connectionStatus: "Estado de la conexión",
        tipGoalWidgetUrl: "URL del Widget de Meta de Propinas:",
        notificationSettings: "Configuración de Notificaciones",
        notificationWidgetUrl: "URL del Widget de Notificaciones:",
        enableTextToSpeech: "Habilitar Texto a Voz",
        ttsLanguage: "Idioma TTS:",
        english: "English",
        spanish: "Español",
        ttsHint: "Habilitar o deshabilitar texto a voz para notificaciones de propinas",
        liveChatSettings: "Configuración de Chat en Vivo",
        chatUrl: "URL del Chat:",
        chatWidgetUrl: "URL del Widget de Chat:",
        externalServices: "Servicios Externos",
        externalNotifications: "Notificaciones Externas",
        discordWebhook: "URL del Webhook de Discord:",
        telegramBotToken: "Token del Bot de Telegram:",
        telegramChatId: "ID del Chat de Telegram:",
        notificationTemplate: "Plantilla de Notificación:",
        templateVarsHint: "Variables disponibles: {from}, {amount}, {usd}, {message}",
        copyright: "© 2025 <a href='https://getty.sh/' target='_blank'>Getty</a> - <a href='https://opensource.org/licenses/MIT' target='_blank'>Licencia MIT</a>",
        independentProject: "Hecho con amor para Odysee ❤️",
        lastTipTitle: "Última propina",
        monthlyGoalTitle: "Meta Mensual",
        notificationsTitle: "Notificaciones",
        liveChatTitle: "Chat en Vivo",
        loading: "Cargando...",
        connectingToWallet: "Conectando a la cartera...",
        urlCopied: "¡URL copiada al portapapeles!",
        failedToCopy: "¡Error al copiar!",
        connected: "Conectado",
        disconnected: "Desconectado",
        colorCustomizationTitle: "Personalización de colores del widget para OBS",
        colorBg: "Fondo",
        colorFont: "Fuente",
        colorBorder: "Borde",
        colorProgress: "Barra de progreso",
        colorAmount: "Cantidad",
        colorIcon: "Icono",
        colorFrom: "Remitente",
        colorMsg: "Fondo mensaje",
        colorMsgAlt: "Fondo mensaje alt",
        colorDonation: "Texto propina",
        colorDonationBg: "Fondo propina",
        colorUsername: "Nombre usuario",
        colorUsernameBg: "Fondo usuario",
        resetColors: "Restablecer colores por defecto",
        colorMsgBg: "Mensaje de fondo",
        colorMsgAltBg: "Mensaje de fondo alt",
        colorMsgBorder: "Borde del mensaje",
        colorMsgText: "Texto principal",
        colorMsgUsername: "Nombre de usuario",
        colorMsgUsernameBg: "Fondo de usuario",
        colorMsgDonation: "Texto de propina",
        colorMsgDonationBg: "Fondo de propina",
        chatWidgetUrlHorizontal: "URL del Widget de Chat (Horizontal)",
        chatWidgetUrlHorizontalHelp: "Mismo widget, pero en modo horizontal. Usa esta URL si quieres que los mensajes se muestren de derecha a izquierda.",
        customAudioTitle: "Audio personalizado",
        useRemoteAudio: "Usar audio remoto",
        useCustomAudio: "Usar audio personalizado",
        removeAudio: "Quitar audio",
        audioHint: "El audio personalizado se reproducirá cuando llegue una nueva propina. Si no selecciona ninguno, se utilizará el audio predeterminado",
        remoteAudioDescription: "Usar audio remoto para notificaciones de propinas",
        customAudioDescription: "Usar audio personalizado para notificaciones de propinas",
        uploadAudioTitle: "Subir audio",
        uploadAudioInstructions: "Subir un archivo de audio para utilizarlo como audio personalizado para las notificaciones de propinas",
        uploadAudioRequirements: "El archivo de audio debe ocupar menos de 1MB y estar en formato MP3",
        play: "Reproducir",
        remove: "Eliminar",
        goalAudioTitle: "Audio de meta",
        raffleTitle: "Regalo",
        raffleCommandLabel: "Comando de sorteo:",
        raffleWinnerTitle: "¡Tenemos un ganador!",
        rafflePrizeLabel: "Premio:",
        rafflePrizePlaceholder: "Nombre o descripción del premio",
        rafflePrizeImageLabel: "Imagen del premio",
        raffleStatusLabel: "Estado:",
        raffleInactive: "Inactivo",
        raffleStart: "Iniciar",
        rafflePause: "Pausar",
        raffleResume: "Reanudar",
        raffleStop: "Detener",
        raffleResetWinners: "Limpiar todo",
        raffleDrawWinner: "Elegir ganador",
        raffleMaxWinnersLabel: "Máx. ganadores",
        raffleMaxWinnersPlaceholder: "Ingresa el máximo de ganadores",
        raffleEnabled: "Habilitado",
        raffleCurrentParticipants: "Participantes actuales",
        raffleWidgetUrlLabel: "URL del Widget de Regalo:",
        raffleWidgetObsHelp: "Usa esta URL en OBS para agregar el widget de regalo a tu stream.",
        raffleAdminSectionTitle: "Sección de Administración de Regalo",
        raffleAdminSectionDesc: "Gestiona tus regalos, elige ganadores y visualiza participantes.",
        raffleAdminSectionWidgetLink: "Widget para integración OBS:",
        raffleInactive: "El sorteo está inactivo o no configurado.",
        raffleParticipants: "participantes",
        raffleLoading: "Cargando...",
        raffleCommand: "Comando:",
        raffleWinners: "Ganadores:",
    }
};

class LanguageManager {
    constructor() {
        this.currentLanguage = localStorage.getItem('getty-language') || 'en';
        this.init();
    }
    
    async init() {
        try {
            const response = await fetch('/api/language');
            if (response.ok) {
                const data = await response.json();
                if (data.currentLanguage && data.currentLanguage !== this.currentLanguage) {
                    this.currentLanguage = data.currentLanguage;
                    localStorage.setItem('getty-language', data.currentLanguage);
                }
            }
        } catch (error) {
            console.error('Failed to sync language with server:', error);
        }
        
        this.updatePageLanguage();
        this.setupLanguageSelector();
    }
    
    async setLanguage(lang) {
        this.currentLanguage = lang;
        localStorage.setItem('getty-language', lang);
        
        try {
            await fetch('/api/language', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ language: lang })
            });
        } catch (error) {
            console.error('Failed to sync language with server:', error);
        }
        
        this.updatePageLanguage();
    }
    
    getText(key) {
        return languages[this.currentLanguage]?.[key] || languages.en[key] || key;
    }
    
    updatePageLanguage() {
        document.documentElement.lang = this.currentLanguage;
        
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const text = this.getText(key);
            if (element.tagName === 'INPUT' && element.type === 'placeholder') {
                element.placeholder = text;
            } else if (key === 'copyright') {
                element.innerHTML = text;
            } else {
                element.textContent = text;
            }
        });
        
        const title = document.querySelector('title');
        if (title) {
            const isAdmin = window.location.pathname.includes('admin.html');
            title.textContent = isAdmin ? this.getText('adminTitle') : this.getText('title');
        }
        
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.setAttribute('content', this.getText('description') || 'Widget app for tip notifications, tip goals, chat rewards and display real-time alerts for your livestreams in Odysee.');
        }
    }
    
    setupLanguageSelector() {
        const languageSelectors = document.querySelectorAll('.language-selector');
        languageSelectors.forEach(selector => {
            selector.value = this.currentLanguage;
            
            const handleLanguageChange = (e) => {
                const selectedValue = e.target.value;
                if (selectedValue !== this.currentLanguage) {
                    this.setLanguage(selectedValue);
                }
            };
            
            selector.removeEventListener('change', handleLanguageChange);
            selector.removeEventListener('click', handleLanguageChange);
            
            selector.addEventListener('change', handleLanguageChange);
            
            if (navigator.userAgent.includes('Firefox')) {
                selector.addEventListener('click', (e) => {
                    setTimeout(() => {
                        if (selector.value !== this.currentLanguage) {
                            this.setLanguage(selector.value);
                        }
                    }, 10);
                });
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.languageManager = new LanguageManager();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { languages, LanguageManager };
}