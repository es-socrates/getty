<template>
  <div class="wander-auth-card">
    <h2>Wander Wallet Login</h2>
    <p class="text-sm mb-3">
      Connect your Arweave wallet via Wander to activate an isolated configuration space.
    </p>

    <div v-if="session.state.address" class="space-y-2">
      <div class="text-sm">
        Address: <span class="font-mono break-all">{{ session.state.address }}</span>
      </div>
      <div class="text-xs text-neutral-600 dark:text-neutral-400">
        Hash: <span class="wander-wallet-hash">{{ session.state.walletHash }}</span>
      </div>
      <div class="wander-auth-status flex items-center gap-2">
        <WsStatusDot :connected="session.state.wsConnected" size="md" sr-label="Estado WebSocket" />
        <span
          class="text-xs"
          :class="session.state.wsConnected ? 'text-green-600' : 'text-red-600'">
          WS: {{ session.state.wsConnected ? 'conectado' : 'desconectado' }}
        </span>
        <span v-if="session.state.expiresAt"
          >exp: {{ new Date(session.state.expiresAt).toLocaleTimeString() }}</span
        >
      </div>
      <div
        v-if="session.state.sessionStale"
        class="p-2 rounded bg-orange-100 dark:bg-orange-900/40 text-xs text-orange-800 dark:text-orange-300">
        La sesión del servidor expiró o se reinició. Reautentica para continuar.
      </div>
      <div class="flex flex-wrap gap-2 pt-2 items-center">
        <button @click="openWs" :disabled="session.state.wsConnected || session.state.sessionStale">
          Abrir WS
        </button>
        <button
          v-if="!session.state.sessionStale"
          class="bg-neutral-500 hover:bg-neutral-600"
          @click="logout">
          Salir
        </button>
        <button
          v-else
          class="bg-blue-600 hover:bg-blue-700"
          @click="reconnect"
          :disabled="busyReconnect">
          {{ busyReconnect ? '...' : 'Reconnect' }}
        </button>
      </div>
    </div>

    <div v-else class="space-y-4">
      <div class="flex flex-col gap-2">
        <input
          v-model="form.address"
          placeholder="Dirección (Arweave)"
          class="w-full border rounded p-2 text-sm" />
        <select v-model="form.mode" class="w-full border rounded p-2 text-sm">
          <option v-if="allowDummy" value="dummy">Firma Dummy (TEST)</option>
          <option value="arconnect">ArConnect / Wander</option>
        </select>
        <div
          v-if="extState.detected"
          class="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
          <span>Extension detected</span>
          <span v-if="extState.activeAddress" class="font-mono truncate max-w-[160px]">{{
            extState.activeAddress
          }}</span>
        </div>
        <div v-else class="text-xs text-red-600">No Wander/ArConnect extension detected</div>
      </div>
      <div v-if="step === 1" class="text-xs text-neutral-600 dark:text-neutral-400">
        1. Request nonce and sign the message.
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
          {{ busy ? '...' : 'Conectar dirección' }}
        </button>
        <button
          v-if="extState.permissions.address && step === 1"
          @click="requestNonce"
          :disabled="busy || !form.address.trim()">
          {{ busy ? '...' : 'Solicitar nonce' }}
        </button>
        <button v-if="step === 2" @click="verifySignature" :disabled="busy">
          {{ busy ? 'Verificando...' : 'Verificar' }}
        </button>
        <button
          v-if="step === 2"
          class="bg-neutral-500 hover:bg-neutral-600"
          @click="resetFlow"
          :disabled="busy">
          Reiniciar
        </button>
        <button
          v-if="extState.permissions.address"
          class="bg-neutral-500 hover:bg-neutral-600"
          @click="refreshAccount"
          :disabled="busy">
          Refrescar cuenta
        </button>
        <button
          v-if="extState.permissions.address"
          class="bg-orange-600 hover:bg-orange-700"
          @click="disconnectExt"
          :disabled="busy">
          Desconectar ext
        </button>
      </div>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <p v-if="info" class="text-xs text-blue-600">{{ info }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { fetchJson } from '../../services/api';
import { useWanderSession } from '../store/wanderSession';
import { getWalletProvider, isDummyAllowed } from '../provider/walletProvider';
import WsStatusDot from '../../components/WsStatusDot.vue';

const session = useWanderSession();
const busy = ref(false);
const busyReconnect = ref(false);
const error = ref(null);
const allowDummy = isDummyAllowed();
const form = ref({ address: '', mode: allowDummy ? 'dummy' : 'arconnect' });
let providerPromise = null;
const step = ref(1);
const challengeMessage = ref('');
const nonceMeta = ref(null);
const info = ref('');
let wsClient = null;
const extState = ref({ detected: false, activeAddress: '', permissions: { address: false } });

async function initProvider() {
  if (!providerPromise) providerPromise = getWalletProvider();
  const provider = await providerPromise;
  extState.value.detected = !!provider?.hasProvider;
  if (provider?.hasProvider) {
    try {
      const addr = await provider.getActiveAddress();
      if (addr) {
        extState.value.activeAddress = addr;
      }
    } catch {}
  }
}
initProvider();

async function connectAddress() {
  error.value = '';
  info.value = '';
  busy.value = true;
  try {
    if (!providerPromise) providerPromise = getWalletProvider();
    const provider = await providerPromise;
    if (!provider.hasProvider) throw new Error('No wallet extension detected');
    await provider.ensurePermissions(['ACCESS_ADDRESS']);
    const addr = await provider.getActiveAddress();
    if (!addr) throw new Error('Extension did not return address');
    extState.value.activeAddress = addr;
    extState.value.permissions.address = true;
    if (!form.value.address) form.value.address = addr;
    info.value = 'Address connected';
  } catch (e) {
    error.value = e.message || String(e);
  } finally {
    busy.value = false;
  }
}

async function refreshAccount() {
  try {
    if (!providerPromise) return;
    const provider = await providerPromise;
    const addr = await provider.getActiveAddress();
    if (addr) {
      extState.value.activeAddress = addr;
      if (!form.value.address) form.value.address = addr;
    }
  } catch {}
}

async function disconnectExt() {
  busy.value = true;
  error.value = '';
  info.value = '';
  try {
    if (!providerPromise) return;
    const provider = await providerPromise;
    if (provider.disconnect) await provider.disconnect();
    extState.value.permissions.address = false;
    extState.value.activeAddress = '';
    info.value = 'Extension disconnected';
  } catch (e) {
    error.value = e.message || String(e);
  } finally {
    busy.value = false;
  }
}

async function requestNonce() {
  error.value = '';
  info.value = '';
  if (!form.value.address.trim()) {
    error.value = 'Address required';
    return;
  }
  busy.value = true;
  try {
    const r = await fetchJson('/api/auth/wander/nonce', {
      method: 'POST',
      body: { address: form.value.address.trim() },
    });
    if (r.error) throw new Error(r.error);
    challengeMessage.value = r.message;
    nonceMeta.value = r;
    step.value = 2;
    if (form.value.mode === 'dummy') {
      info.value = 'Nonce received. In dummy mode we will automatically sign with TEST';
    } else {
      info.value = 'Nonce received. Proceed to sign with your wallet (ArConnect/Wander).';
    }
  } catch (e) {
    error.value = e.message || String(e);
  } finally {
    busy.value = false;
  }
}

async function verifySignature() {
  error.value = '';
  info.value = '';
  if (!nonceMeta.value) {
    error.value = 'No nonce available';
    return;
  }
  busy.value = true;
  try {
    let body;
    if (form.value.mode === 'dummy') {
      body = {
        address: nonceMeta.value.address,
        publicKey: 'FAKE_PUBLIC_KEY_BASE64URL',
        signature: 'TEST',
      };
    } else {
      if (!providerPromise) providerPromise = getWalletProvider();
      const provider = await providerPromise;
      if (!provider) throw new Error('No wallet provider (ArConnect/Wander) detected');
      await provider.ensurePermissions(['ACCESS_ADDRESS', 'ACCESS_PUBLIC_KEY']);
      let address = form.value.address.trim();
      if (!address) address = await provider.getActiveAddress();
      if (!address) throw new Error('No active address found');
      if (address !== nonceMeta.value.address)
        throw new Error('Signing address differs from requested');
      const msg = challengeMessage.value;
      if (!msg) throw new Error('Challenge message not available');
      const { signature, publicKey } = await provider.signMessage(msg);
      body = { address, publicKey, signature };
    }
    const r = await fetchJson('/api/auth/wander/verify', { method: 'POST', body });
    if (!r.success) throw new Error(r.error || 'verify_failed');
    await session.refreshSession();
    info.value = 'Session created';
    step.value = 1;
    challengeMessage.value = '';
    nonceMeta.value = null;
  } catch (e) {
    const msg = e.message || String(e);
    error.value = msg;
    if (/bad_signature/.test(msg)) {
      try {
        window.dispatchEvent(
          new CustomEvent('getty:wallet-bad-signature', { detail: { source: 'verifySignature' } })
        );
      } catch {}
    }
  } finally {
    busy.value = false;
  }
}

function resetFlow() {
  step.value = 1;
  challengeMessage.value = '';
  nonceMeta.value = null;
  error.value = '';
  info.value = '';
}

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
  wsClient.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'initTenant' && !session.state.walletHash) {
        session.refreshSession();
      }
    } catch {}
  };
}
function closeWs() {
  if (wsClient) {
    try {
      wsClient.close();
    } catch {}
    wsClient = null;
  }
}

async function reconnect() {
  busyReconnect.value = true;
  try {
    await session.attemptReconnect();
  } catch {
  } finally {
    busyReconnect.value = false;
  }
}
</script>

<style scoped>
@import '../styles/wander.css';
</style>
