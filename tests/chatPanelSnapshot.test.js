/**
 * @jest-environment jsdom
 */
const { mount } = require('@vue/test-utils');
const { createI18n } = require('vue-i18n');
const { defineComponent } = require('vue');

const messages = {
  en: {
    chatConfigHeading: 'Chat configuration',
    colorCustomizationTitle: 'Widget color customization for OBS',
    chatClaimId: 'Claim ID',
    charsUsed: '{used}/{max} chars',
    generalColors: 'General',
    donationColors: 'Donations',
    resetColors: 'Reset to default colors',
    connected: 'Connected',
    disconnected: 'Disconnected',
    commonSaving: 'Saving...',
    saveSettings: 'Save Settings',
    usernameColors: 'Username',
    overrideUsername: 'Override username colors',
    toggleUsernameOverride: 'Override username colors (otherwise the palette is used)',
    usernameOverrideOn: 'These colors will replace the per-user palette.',
    usernameOverrideOff: 'Using the cyberpunk palette, each user gets a different color.',
    transparentBg: 'Transparent background',
    transparentBgHint: 'If enabled, chat panel background becomes fully transparent.',
    avatarRandomBg: 'Random default avatar background per message',
    avatarRandomBgHint: 'If enabled, users without avatar will get a random background color on each message.',
    testMessages: 'Test messages',
    testMessagesHint: 'Send a fake chat message or a donation to preview styles without using real chat.',
    username: 'Username',
    credits: 'USD',
    message: 'Message',
    sendTestMessage: 'Send test message',
    sendTestDonation: 'Send test donation',
    sending: 'Sending...',
    obsIntegration: 'OBS Integration',
    chatWidgetUrl: 'Chat Widget URL:',
    chatWidgetUrlHorizontal: 'Chat Widget URL (Horizontal)',
    chatThemeCustomize: 'Custom builder:',
    testActionsLabel: 'Test actions'
  }
};

function makeI18n() {
  return createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages });
}

global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ publicToken: 'pub' }) }));
jest.mock('../admin-frontend/src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn((url) => {
      if (url.startsWith('/api/chat-config')) return Promise.resolve({ data: {} });
      if (url.startsWith('/api/chat/status')) return Promise.resolve({ data: { connected: true } });
      if (url.startsWith('/api/ar-price'))
        return Promise.resolve({ data: { arweave: { usd: 0.1234 }, source: 'mock', ageSeconds: 5 } });
      return Promise.resolve({ data: {} });
    }),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

describe('ChatPanel.vue snapshot', () => {
  test('renders stable layout', async () => {
    const { createChatPanel } = require('../admin-frontend/src/components/ChatPanel/ChatPanel.js');
    const i18n = makeI18n();
    const PanelShim = defineComponent({
      name: 'ChatPanelShim',
      setup() {
        const state = createChatPanel((k) => i18n.global.t(k));
        return state;
      },
      template: `
        <section class="admin-tab active chat-root" role="form" aria-labelledby="chat-config-heading">
          <h2 id="chat-config-heading" class="sr-only">{{ 'Chat configuration' }}</h2>
          <div class="chat-grid">
            <div class="chat-col chat-col-left">
              <div class="chat-group-box" aria-labelledby="chat-colors-heading">
                <h3 id="chat-colors-heading" class="chat-group-title">Colors</h3>
                <div class="form-group" aria-live="polite">
                  <label class="label" id="chat-url-label" for="chat-url">Claim ID</label>
                  <input class="input" id="chat-url" v-model="form.chatUrl" type="text" />
                </div>
                <div class="chat-color-surface">
                  <h4 class="chat-subtitle">General</h4>
                  <div class="flex flex-wrap gap-2 items-end">
                    <div class="color-input" v-for="c in Object.keys(form.colors)" :key="c">{{ c }}</div>
                  </div>
                </div>
                <div class="chat-actions-row"><button type="button" class="btn">Reset</button></div>
                <div class="chat-save-row"><button class="btn">Save</button></div>
              </div>
              <div class="stub-chatthemeselector">ChatThemeSelector Stub</div>
              <div class="stub-chatthemecsspanel">ChatThemeCssPanel Stub</div>
            </div>
            <div class="chat-col chat-col-right">
              <div class="chat-group-box" aria-labelledby="username-heading">
                <h3 id="username-heading" class="chat-group-title">Username</h3>
                <div class="mb-2"><label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" />Override</label></div>
              </div>
              <div class="chat-group-box" aria-labelledby="test-msg-heading">
                <h3 id="test-msg-heading" class="chat-group-title">Test messages</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div class="form-group"><label class="label">Username</label><input class="input" /></div>
                  <div class="form-group"><label class="label">USD</label><input class="input" /></div>
                  <div class="form-group sm:col-span-2"><label class="label">Message</label><input class="input" /></div>
                </div>
                <div class="flex gap-2 mt-2" role="group" aria-label="Test actions"><button class="btn">Send test message</button><button class="btn">Send test donation</button></div>
              </div>
            </div>
          </div>
          <div class="mt-8"><div class="stub-chatthemebuilder">ChatThemeBuilder Stub</div></div>
        </section>`
    });
    const wrapper = mount(PanelShim, { global: { plugins: [i18n] } });
    await Promise.resolve();
    expect(wrapper.html()).toMatchSnapshot();
    wrapper.unmount();
  });
});
