const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(process.cwd(), 'config', 'socialmedia-config.json');

class SocialMediaModule {
    constructor() {
        this.configFile = CONFIG_FILE;
    }

    loadConfig() {
        if (fs.existsSync(this.configFile)) {
            return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        }
        return [];
    }

    saveConfig(config) {
        fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
    }
}

module.exports = SocialMediaModule;
