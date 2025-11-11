<template>
  <div class="wander-auth-card">
    <h2>{{ t('wanderAuth.title') }}</h2>
    <p class="text-sm mb-3">
      {{ t('wanderAuth.description') }}
    </p>

    <div v-if="session.state.address" class="space-y-2">
      <div class="text-sm">
        {{ t('wanderAuth.addressLabel') }}
        <span class="font-mono break-all">{{ session.state.address }}</span>
      </div>
      <div class="text-xs text-neutral-600 dark:text-neutral-400">
        {{ t('wanderAuth.hashLabel') }}
        <span class="wander-wallet-hash">{{ session.state.walletHash }}</span>
      </div>
      <div class="wander-auth-status flex items-center gap-2">
        <WsStatusDot
          :connected="session.state.wsConnected"
          size="md"
          :sr-label="t('wanderAuth.wsStatusSr')" />
        <span
          class="text-xs"
          :class="session.state.wsConnected ? 'text-green-600' : 'text-red-600'">
          {{
            t('wanderAuth.wsStatus', {
              status: t(session.state.wsConnected ? 'connected' : 'disconnected'),
            })
          }}
        </span>
        <span v-if="session.state.expiresAt">
          {{ t('wanderAuth.expiresLabel') }}
          {{ new Date(session.state.expiresAt).toLocaleTimeString() }}
        </span>
      </div>
      <div
        v-if="session.state.sessionStale"
        class="p-2 rounded bg-orange-100 dark:bg-orange-900/40 text-xs text-orange-800 dark:text-orange-300">
        {{ t('wanderAuth.sessionStale') }}
      </div>
      <div class="flex flex-wrap gap-2 pt-2 items-center">
        <button @click="openWs" :disabled="session.state.wsConnected || session.state.sessionStale">
          {{ t('wanderAuth.openWs') }}
        </button>
        <button
          v-if="!session.state.sessionStale"
          class="bg-neutral-500 hover:bg-neutral-600"
          @click="logout">
          {{ t('wanderAuth.logout') }}
        </button>
        <button
          v-else
          class="bg-blue-600 hover:bg-blue-700"
          @click="reconnect"
          :disabled="busyReconnect">
          {{ busyReconnect ? '...' : t('wanderAuth.reconnect') }}
        </button>
      </div>
    </div>

    <div v-else class="space-y-4">
      <div class="flex flex-col gap-2">
        <input
          v-model="form.address"
          :placeholder="t('wanderAuth.addressPlaceholder')"
          class="w-full border rounded p-2 text-sm" />
        <select v-model="form.mode" class="w-full border rounded p-2 text-sm">
          <option v-if="allowDummy" value="dummy">{{ t('wanderAuth.modeDummy') }}</option>
          <option value="arconnect">{{ t('wanderAuth.modeArconnect') }}</option>
        </select>
        <div
          v-if="extState.detected"
          class="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
          <span>{{ t('wanderAuth.extensionDetected') }}</span>
          <span v-if="extState.activeAddress" class="font-mono truncate max-w-[160px]">{{
            extState.activeAddress
          }}</span>
        </div>
        <div v-else class="text-xs text-red-600">{{ t('wanderAuth.extensionMissing') }}</div>
      </div>
      <div v-if="step === 1" class="text-xs text-neutral-600 dark:text-neutral-400">
        {{ t('wanderAuth.stepOneHint') }}
      </div>
      <div
        v-if="step === 2"
        class="bg-neutral-50 dark:bg-neutral-800 p-2 rounded text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
        {{ challengeMessage || '—' }}
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="!extState.permissions.address"
          @click="connectAddress"
          :disabled="busy || !extState.detected">
          {{ busy ? '...' : t('wanderAuth.connectAddress') }}
        </button>
        <button
          v-if="extState.permissions.address && step === 1"
          @click="requestNonce"
          :disabled="busy || !form.address.trim()">
          {{ busy ? '...' : t('wanderAuth.requestNonce') }}
        </button>
        <button v-if="step === 2" @click="verifySignature" :disabled="busy">
          {{ busy ? t('wanderAuth.verifying') : t('wanderAuth.verify') }}
        </button>
        <button
          v-if="step === 2"
          class="bg-neutral-500 hover:bg-neutral-600"
          @click="resetFlow"
          :disabled="busy">
          {{ t('wanderAuth.reset') }}
        </button>
        <button
          v-if="extState.permissions.address"
          class="bg-neutral-500 hover:bg-neutral-600"
          @click="refreshAccount"
          :disabled="busy">
          {{ t('wanderAuth.refreshAccount') }}
        </button>
        <button
          v-if="extState.permissions.address"
          class="bg-orange-600 hover:bg-orange-700"
          @click="disconnectExt"
          :disabled="busy">
          {{ t('wanderAuth.disconnectExtension') }}
        </button>
      </div>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <p v-if="info" class="text-xs text-blue-600">{{ info }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchJson } from '../../services/api';
import { useWanderSession } from '../store/wanderSession';
import { getWalletProvider, isDummyAllowed } from '../provider/walletProvider';
import { MINIMUM_WALLET_PERMISSIONS } from '../provider/walletTypes';
import WsStatusDot from '../../components/WsStatusDot.vue';

/**
 * @typedef {import('../provider/walletTypes').WalletAdapter} WalletAdapter
 * @typedef {'dummy' | 'arconnect'} AuthMode
 * @typedef {{ message: string; address: string; error?: string; [key: string]: unknown }} WanderNonceResponse
 * @typedef {{ success?: boolean; error?: string }} WanderVerifyResponse
 * @typedef {{ detected: boolean; activeAddress: string; permissions: { address: boolean } }} ExtensionState
 * @typedef {{ address: string; publicKey: string; signature: string }} VerifyBody
 * @typedef {{ address: string; mode: AuthMode }} FormState
 */

const session = useWanderSession();
const { t } = useI18n();
const busy = ref(false);
const busyReconnect = ref(false);
const error = ref(/** @type {string | null} */ (null));
const allowDummy = isDummyAllowed();
const form = ref(
  /** @type {FormState} */ ({ address: '', mode: allowDummy ? 'dummy' : 'arconnect' })
);
/** @type {Promise<WalletAdapter> | null} */
let providerPromise = null;
const step = ref(1);
const challengeMessage = ref('');
const nonceMeta = ref(/** @type {WanderNonceResponse | null} */ (null));
const info = ref('');
/** @type {WebSocket | null} */
let wsClient = null;
const extState = ref(
  /** @type {ExtensionState} */ ({
    detected: false,
    activeAddress: '',
    permissions: { address: false },
  })
);

/**
 * @param {string} message
 * @returns {string}
 */
function mapErrorMessage(message) {
  if (message === 'verify_failed') return t('wanderAuth.errorVerifyFailed');
  if (/bad_signature/.test(message)) return t('wanderAuth.errorBadSignature');
  return message;
}

/**
 * @returns {Promise<WalletAdapter>}
 */
async function resolveProvider() {
  if (!providerPromise) providerPromise = getWalletProvider();
  return providerPromise;
}

/**
 * @returns {Promise<void>}
 */
async function initProvider() {
  try {
    const provider = await resolveProvider();
    extState.value.detected = provider.hasProvider;
    if (provider.hasProvider) {
      const addr = await provider.getActiveAddress().catch(() => '');
      if (addr) {
        extState.value.activeAddress = addr;
        extState.value.permissions.address = true;
      }
    }
  } catch {
    extState.value.detected = false;
  }
}
void initProvider();

/**
 * @returns {Promise<void>}
 */
async function connectAddress() {
  error.value = null;
  info.value = '';
  busy.value = true;
  try {
    const provider = await resolveProvider();
    if (!provider.hasProvider) throw new Error(t('wanderAuth.errorNoWallet'));
    await provider.ensurePermissions(['ACCESS_ADDRESS']);
    const addr = await provider.getActiveAddress();
    if (!addr) throw new Error(t('wanderAuth.errorNoAddressFromExtension'));
    extState.value.activeAddress = addr;
    extState.value.permissions.address = true;
    if (!form.value.address) form.value.address = addr;
    info.value = t('wanderAuth.infoAddressConnected');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? '');
    error.value = mapErrorMessage(message);
  } finally {
    busy.value = false;
  }
}

/**
 * @returns {Promise<void>}
 */
async function refreshAccount() {
  try {
    const provider = await resolveProvider();
    const addr = await provider.getActiveAddress();
    if (addr) {
      extState.value.activeAddress = addr;
      if (!form.value.address) form.value.address = addr;
    }
  } catch {
    /* noop */
  }
}

/**
 * @returns {Promise<void>}
 */
async function disconnectExt() {
  busy.value = true;
  error.value = null;
  info.value = '';
  try {
    const provider = await resolveProvider();
    await provider.disconnect();
    extState.value.permissions.address = false;
    extState.value.activeAddress = '';
    info.value = t('wanderAuth.infoExtensionDisconnected');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? '');
    error.value = mapErrorMessage(message);
  } finally {
    busy.value = false;
  }
}

/**
 * @returns {Promise<void>}
 */
async function requestNonce() {
  error.value = null;
  info.value = '';
  const trimmed = form.value.address.trim();
  if (!trimmed) {
    error.value = t('wanderAuth.errorAddressRequired');
    return;
  }
  busy.value = true;
  try {
    const response = /** @type {WanderNonceResponse} */ (
      await fetchJson('/api/auth/wander/nonce', {
        method: 'POST',
        body: { address: trimmed },
      })
    );
    if (response.error) throw new Error(String(response.error));
    challengeMessage.value = String(response.message ?? '');
    nonceMeta.value = response;
    step.value = 2;
    info.value =
      form.value.mode === 'dummy' ? t('wanderAuth.infoNonceDummy') : t('wanderAuth.infoNonce');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? '');
    error.value = mapErrorMessage(message);
  } finally {
    busy.value = false;
  }
}

/**
 * @returns {Promise<void>}
 */
async function verifySignature() {
  error.value = null;
  info.value = '';
  if (!nonceMeta.value) {
    error.value = t('wanderAuth.errorNoNonce');
    return;
  }
  busy.value = true;
  try {
    /** @type {VerifyBody} */
    let body;
    if (form.value.mode === 'dummy') {
      body = {
        address: nonceMeta.value.address,
        publicKey: 'FAKE_PUBLIC_KEY_BASE64URL',
        signature: 'TEST',
      };
    } else {
      const provider = await resolveProvider();
      if (!provider.hasProvider) throw new Error(t('wanderAuth.errorNoWalletProvider'));
      await provider.ensurePermissions([...MINIMUM_WALLET_PERMISSIONS]);
      let address = form.value.address.trim();
      if (!address) address = await provider.getActiveAddress();
      if (!address) throw new Error(t('wanderAuth.errorNoActiveAddress'));
      if (address !== nonceMeta.value.address)
        throw new Error(t('wanderAuth.errorAddressMismatch'));
      const msg = challengeMessage.value;
      if (!msg) throw new Error(t('wanderAuth.errorNoChallenge'));
      const { signature, publicKey } = await provider.signMessage(msg);
      body = { address, publicKey, signature };
    }
    const verifyResponse = /** @type {WanderVerifyResponse} */ (
      await fetchJson('/api/auth/wander/verify', {
        method: 'POST',
        body,
      })
    );
    if (!verifyResponse.success) throw new Error(verifyResponse.error || 'verify_failed');
    await session.refreshSession();
    info.value = t('wanderAuth.infoSessionCreated');
    step.value = 1;
    challengeMessage.value = '';
    nonceMeta.value = null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? '');
    error.value = mapErrorMessage(message);
    if (/bad_signature/.test(message)) {
      try {
        window.dispatchEvent(
          new CustomEvent('getty:wallet-bad-signature', { detail: { source: 'verifySignature' } })
        );
      } catch {
        /* noop */
      }
    }
  } finally {
    busy.value = false;
  }
}

function resetFlow() {
  step.value = 1;
  challengeMessage.value = '';
  nonceMeta.value = null;
  error.value = null;
  info.value = '';
}

/**
 * @returns {Promise<void>}
 */
async function logout() {
  await session.logout();
  closeWs();
}

function openWs() {
  if (wsClient || !session.state.walletHash) return;
  const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  wsClient = new WebSocket(wsUrl);
  wsClient.onopen = () => {
    session.markWsConnected(true);
  };
  wsClient.onclose = () => {
    session.markWsConnected(false);
    wsClient = null;
  };
  /**
   * @param {MessageEvent<string>} ev
   */
  wsClient.onmessage = (ev) => {
    try {
      const msg = /** @type {{ type?: string }} */ (JSON.parse(ev.data ?? '{}'));
      if (msg.type === 'initTenant' && !session.state.walletHash) {
        void session.refreshSession();
      }
    } catch {
      /* noop */
    }
  };
}

function closeWs() {
  if (wsClient) {
    try {
      wsClient.close();
    } catch {
      /* noop */
    }
    wsClient = null;
  }
}

/**
 * @returns {Promise<void>}
 */
async function reconnect() {
  busyReconnect.value = true;
  try {
    await session.attemptReconnect();
  } catch {
    /* noop */
  } finally {
    busyReconnect.value = false;
  }
}
</script>

<style scoped>
@import '../styles/wander.css';
</style>
