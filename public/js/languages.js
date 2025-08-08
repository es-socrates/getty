const languages = {
    en: {
        liveviewsClaimId: "Channel ClaimID:",
        liveviewsColorsTitle: "Colors",
        liveviewsBgColor: "Background color",
        liveviewsFontColor: "Font color",
        liveviewsFontFamily: "Font",
        liveviewsSize: "Size (px)",
        liveviewsIcon: "Custom icon",
        liveviewsWidgetUrl: "Liveviews Widget URL:",
        liveNow: "Live",
        notLive: "Not live",
        viewers: "viewers",
        noData: "No data",
        failedToConnect: "Failed to connect to server",
        errorFetchingStatus: "Error fetching status",
        views: "views",
        checkStatuses: "Check statuses",
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
        chatUrl: "ClaimID of the live stream on Odysee:",
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
        raffleWinnerTitle: "We have a winner!",
        rafflePrizeLabel: "Prize:",
        rafflePrizePlaceholder: "Prize name or description",
        rafflePrizeImageLabel: "Prize Image",
        raffleStatusLabel: "Status:",
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
        raffleParticipants: "participants",
        raffleLoading: "Loading...",
        raffleCommandLabel: "Command:",
        raffleCommand: "Command:",
        raffleCommandHint: "You can use the command with or without ! (e.g., giveaway or !giveaway).",
        raffleWinners: "Winners:",
        sidebarliveviews: "Viewers",
        raffleNotConfigured: "The draw is not configured.",
        raffleActive: 'The draw is active',
        rafflePaused: 'The draw is paused',
        raffleInactive: 'The draw is stopped',
        raffleActiveTitle: "Active",
        liveviewsViewersLabel: "Custom label for viewers:",
        invalidArweaveWalletLastTip: "The wallet address (Last Tip) is not valid for the Arweave network.",
        invalidArweaveWalletTipGoal: "The wallet address (Tip Goal) is not valid for the Arweave network.",
        socialMediaSidebar: "Social Networks",
        socialMediaTitle: "Social Networks",
        socialMediaNameLabel: "Name",
        socialMediaLinkLabel: "Link",
        socialMediaIconLabel: "Icon",
        socialMediaAddBtn: "Add",
        socialMediaSaveBtn: "Save configuration",
        socialMediaWidgetTitle: "OBS Integration",
        socialMediaWidgetUrlLabel: "OBS Link:",
        socialMediaCustomIconLabel: "Custom Icon",
        obsIntegrationHelpIntro: "Use these widget URLs in OBS as Browser sources. Adjust width/height as suggested.",
        obsAvailableWidgetsTitle: "Available Widgets",
        tipNotification: "Donation Notification",
        persistentNotificationsTitle: "Persistent Notifications",
        obsWidgetsJsonHelp: "Open <a href=\"/obs/widgets\" target=\"_blank\"><code>/obs/widgets</code></a> for a JSON of all URLs and recommended sizes.",
        obsTipsTitle: "Tips",
        obsTipShutdownSource: "Enable \u201cShutdown source when not visible\u201d in OBS if you see stale data.",
        obsTipScaleCss: "Set custom CSS scaling with <code>transform: scale(0.9)</code> if needed.",
        obsTipFirewall: "Ensure your firewall allows local connections to this server (default <code>http://localhost:3000</code>).",
        obsWidgetLastTip: "<strong>Last Tip</strong>: <code>/widgets/last-tip</code> — 380x120",
        obsWidgetTipGoal: "<strong>Donation Goal</strong>: <code>/widgets/tip-goal</code> — 280x120",
        obsWidgetTipNotification: "<strong>Donation Notification</strong>: <code>/widgets/tip-notification</code> — 380x120",
        obsWidgetChat: "<strong>Live Chat</strong>: <code>/widgets/chat</code> — 350x500",
        obsWidgetPersistentNotifications: "<strong>Persistent Notifications</strong>: <code>/widgets/persistent-notifications</code> — 380x500",
        obsWsIpLabel: "OBS WebSocket IP",
        obsWsIpPlaceholder: "127.0.0.1",
        obsWsPortLabel: "OBS WebSocket Port",
        obsWsPortPlaceholder: "4455",
        obsWsPasswordLabel: "OBS WebSocket Password",
        chatThemeLabel: "Chat theme:",
        chatThemeSelect: "Select theme",
        chatThemeEdit: "Create/Edit theme",
        chatThemePreview: "Theme preview",
        chatThemeNamePlaceholder: "Theme name",
        chatThemeCSSPlaceholder: "Theme CSS",
        chatThemeSave: "Save theme",
        chatThemeDelete: "Delete theme",
        obsWsPasswordPlaceholder: "Password (if set)",
        saveObsWsSettings: "Save OBS connection",
        obsWsReminderTitle: "Important:",
        obsWsReminderDesc: "When configuring OBS WebSocket with a remote IP, the widget URLs will change so OBS can access them from that address. You must use the remote IP, not the one sent by OBS.",
        obsWsReminderNetwork: "- Make sure the IP and port are accessible from your network.",
        obsWsReminderRemoteUrl: "- OBS must use the new widget URL (remote IP), not localhost.",
        obsWsReminderLocalMode: "- If you don't use OBS WebSocket, widgets will work in localhost mode.",
        obsWsReminderUpdateUrl: "- If you change the IP, update the widget URLs in OBS.",
        obsWsReminderFirewall: "- Make sure your firewall allows connections to the OBS port.",
        obsWsReminderNetworkConfig: "- If you have issues, check your network and firewall configuration.",
        obsWsReminderCopyUrl: "- You can copy the updated URL from each integration panel in Getty.",
        raffleWarningTitle: "Warning:",
        raffleWarningChat: "For the <b>participant counter</b> to work properly, make sure you have <b>chat enabled</b> from the Getty administration.",
        chatThemeCopyLabel: "Theme CSS for OBS:",
        chatThemeCopyBtn: "Copy CSS",
        chatThemeCopySuccess: "CSS copied to clipboard",
        chatThemeDeleteOnlyCustom: "Only custom themes can be deleted.",
        chatThemeCancel: "Cancel"
    },
    
    es: {
        liveviewsClaimId: "ClaimID del canal:",
        liveviewsColorsTitle: "Colores",
        liveviewsBgColor: "Color de fondo",
        liveviewsFontColor: "Color de fuente",
        liveviewsFontFamily: "Fuente",
        liveviewsSize: "Tamaño (px)",
        liveviewsIcon: "Icono personalizado",
        liveviewsWidgetUrl: "URL del Widget de Liveviews:",
        liveNow: "En vivo",
        notLive: "No en vivo",
        viewers: "personas",
        noData: "Sin datos",
        failedToConnect: "No se pudo conectar al servidor",
        errorFetchingStatus: "Error al obtener el estado",
        views: "vistas",
        checkStatuses: "Comprobar estados",
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
        updateStatus: "Actualizar estado",
        lastTipSettings: "Configuración de última propina",
        arWalletAddress: "Dirección de cartera AR (Arweave):",
        saveSettings: "Guardar configuración",
        obsIntegration: "Integración OBS",
        lastTipWidgetUrl: "URL del widget de última propina:",
        copy: "Copiar",
        tipGoalSettings: "Configuración de meta de propinas",
        monthlyGoal: "Meta mensual (AR):",
        tipWidget: "Widget de propinas",
        refresh: "Actualizar",
        connectionStatus: "Estado de la conexión",
        tipGoalWidgetUrl: "URL del widget de meta de propinas:",
        notificationSettings: "Configuración de Notificaciones",
        notificationWidgetUrl: "URL del widget de Notificaciones:",
        enableTextToSpeech: "Habilitar Texto a Voz",
        ttsLanguage: "Idioma TTS:",
        english: "English",
        spanish: "Español",
        ttsHint: "Habilitar o deshabilitar texto a voz para notificaciones de propinas",
        liveChatSettings: "Configuración de chat en vivo",
        chatUrl: "ClaimID del directo en Odysee:",
        chatWidgetUrl: "URL del widget de chat:",
        externalServices: "Servicios externos",
        externalNotifications: "Notificaciones externas",
        discordWebhook: "URL del webhook de Discord:",
        telegramBotToken: "Token del bot de Telegram:",
        telegramChatId: "ID del chat de Telegram:",
        notificationTemplate: "Plantilla de notificación:",
        templateVarsHint: "Variables disponibles: {from}, {amount}, {usd}, {message}",
        copyright: "© 2025 <a href='https://getty.sh/' target='_blank'>Getty</a> - <a href='https://opensource.org/licenses/MIT' target='_blank'>Licencia MIT</a>",
        independentProject: "Hecho con amor para Odysee ❤️",
        lastTipTitle: "Última propina",
        monthlyGoalTitle: "Meta mensual",
        notificationsTitle: "Notificaciones",
        liveChatTitle: "Chat en vivo",
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
        raffleTitle: "Giveaway",
        raffleWinnerTitle: "¡Tenemos un ganador!",
        rafflePrizeLabel: "Premio:",
        rafflePrizePlaceholder: "Nombre o descripción del premio",
        rafflePrizeImageLabel: "Imagen del premio",
        raffleStatusLabel: "Estado:",
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
        raffleWidgetUrlLabel: "URL del widget Giveaway:",
        raffleWidgetObsHelp: "Usa esta URL en OBS para agregar el widget de Giveaway a tu stream.",
        raffleAdminSectionTitle: "Sección de administración de Giveaway",
        raffleAdminSectionDesc: "Gestiona tus giveaways, elige ganadores y visualiza participantes.",
        raffleAdminSectionWidgetLink: "Widget para integración OBS:",
        raffleParticipants: "participantes",
        raffleLoading: "Cargando...",
        raffleCommandLabel: "Comando:",
        raffleCommand: "Comando:",
        raffleCommandHint: "Puedes usar el comando con o sin ! (ej.: sorteo o !sorteo).",
        raffleWinners: "Ganadores:",
        sidebarliveviews: "Espectadores",
        raffleNotConfigured: "El sorteo no está configurado o está inactivo.",
        raffleActive: 'El sorteo está activo',
        rafflePaused: 'El sorteo está en pausa',
        raffleInactive: 'El sorteo está detenido',
        raffleActiveTitle: "Activo",
        liveviewsViewersLabel: "Etiqueta personalizada para espectadores:",
        invalidArweaveWalletLastTip: "La dirección de billetera (Última Propina) no es válida para la red Arweave.",
        invalidArweaveWalletTipGoal: "La dirección de billetera (Meta de Propinas) no es válida para la red Arweave.",
        socialMediaSidebar: "Redes sociales",
        socialMediaTitle: "Redes sociales",
        socialMediaNameLabel: "Nombre",
        socialMediaLinkLabel: "Enlace",
        socialMediaIconLabel: "Icono",
        socialMediaAddBtn: "Agregar",
        socialMediaSaveBtn: "Guardar configuración",
        socialMediaWidgetTitle: "Widget para OBS",
        socialMediaCustomIconLabel: "Icono personalizado",
        obsIntegrationHelpIntro: "Usa estas URLs de widgets en OBS como fuentes de navegador. Ajusta el ancho/alto según lo sugerido.",
        obsAvailableWidgetsTitle: "Widgets disponibles",
        tipNotification: "Notificación de propina",
        persistentNotificationsTitle: "Notificaciones persistentes",
        obsWidgetsJsonHelp: "Abre <a href=\"/obs/widgets\" target=\"_blank\"><code>/obs/widgets</code></a> para un JSON con todas las URLs y tamaños recomendados.",
        obsTipsTitle: "Consejos",
        obsTipShutdownSource: "Activa \u201cApagar la fuente cuando no sea visible\u201d en OBS si ves datos obsoletos.",
        obsTipScaleCss: "Configura un escalado CSS con <code>transform: scale(0.9)</code> si es necesario.",
        obsTipFirewall: "Asegúrate de que tu firewall permita conexiones locales a este servidor (por defecto <code>http://localhost:3000</code>).",
        obsWidgetLastTip: "<strong>Última propina</strong>: <code>/widgets/last-tip</code> — 380x120",
        obsWidgetTipGoal: "<strong>Meta de propinas</strong>: <code>/widgets/tip-goal</code> — 280x120",
        obsWidgetTipNotification: "<strong>Notificación de propina</strong>: <code>/widgets/tip-notification</code> — 380x120",
        obsWidgetChat: "<strong>Chat en vivo</strong>: <code>/widgets/chat</code> — 350x500",
        obsWidgetPersistentNotifications: "<strong>Notificaciones persistentes</strong>: <code>/widgets/persistent-notifications</code> — 380x500",
        obsWsIpLabel: "IP de OBS WebSocket",
        obsWsIpPlaceholder: "127.0.0.1",
        obsWsPortLabel: "Puerto de OBS WebSocket",
        obsWsPortPlaceholder: "4455",
        obsWsPasswordLabel: "Contraseña de OBS WebSocket",
        chatThemeLabel: "Tema del chat:",
        chatThemeSelect: "Seleccionar tema",
        chatThemeEdit: "Crear/Editar tema",
        chatThemePreview: "Vista previa del tema",
        chatThemeNamePlaceholder: "Nombre del tema",
        chatThemeCSSPlaceholder: "CSS del tema",
        chatThemeSave: "Guardar tema",
        chatThemeDelete: "Eliminar tema",
        obsWsPasswordPlaceholder: "Contraseña (si aplica)",
        saveObsWsSettings: "Guardar conexión OBS",
        obsWsReminderTitle: "Importante:",
        obsWsReminderDesc: "Al configurar OBS WebSocket con una IP remota, las URLs de los widgets cambiarán para que OBS pueda acceder desde esa dirección. Debes usar la IP remota, no la que envía OBS.",
        obsWsReminderNetwork: "- Verifica que la IP y el puerto sean accesibles desde tu red.",
        obsWsReminderRemoteUrl: "- OBS debe usar la nueva URL (IP remota) del widget, no localhost.",
        obsWsReminderLocalMode: "- Si no usas WebSocket de OBS, los widgets funcionarán en modo localhost.",
        obsWsReminderUpdateUrl: "- Si cambias la IP, actualiza las URLs de los widgets en OBS.",
        obsWsReminderFirewall: "- Asegúrate de que el firewall permita conexiones al puerto de OBS.",
        obsWsReminderNetworkConfig: "- Si tienes problemas, revisa la configuración de red y firewall.",
        obsWsReminderCopyUrl: "- Puedes copiar la URL actualizada desde cada panel de integración en Getty.",
        raffleWarningTitle: "Advertencia:",
        raffleWarningChat: "Para que el <b>contador de participantes</b> funcione correctamente, asegúrate de tener <b>el chat habilitado</b> desde la administración de Getty.",
        chatThemeCopyLabel: "CSS del tema para OBS:",
        chatThemeCopyBtn: "Copiar CSS",
        chatThemeCopySuccess: "CSS copiado al portapapeles",
        chatThemeDeleteOnlyCustom: "Solo se pueden eliminar temas personalizados.",
        chatThemeCancel: "Cancelar"
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
            } else if (/<[a-z][\s\S]*>/i.test(text)) {
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
