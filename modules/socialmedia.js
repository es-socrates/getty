const fs = require('fs');
const path = require('path');

const ENV = process.env.NODE_ENV || 'development';
const CONFIG_FILE = path.join(
    process.cwd(),
    'config',
    ENV === 'test' ? 'socialmedia-config.test.json' : 'socialmedia-config.json'
);

class SocialMediaModule {
    constructor() {
        this.configFile = CONFIG_FILE;

        try {
            const dir = path.dirname(this.configFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        } catch (e) {
            console.error('[socialmedia] failed to ensure config dir:', e);
        }
    }

    loadConfig() {
        if (fs.existsSync(this.configFile)) {
            return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        }
        return [];
    }

    saveConfig(config) {
        const tmp = this.configFile + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
        fs.renameSync(tmp, this.configFile);
    }
}

module.exports = SocialMediaModule;
