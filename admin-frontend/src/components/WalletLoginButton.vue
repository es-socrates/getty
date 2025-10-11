<template>
  <div class="relative" :class="{ 'opacity-70 pointer-events-none': busy }">
    <!-- Logged out button -->
    <button
      v-if="!session.state.address"
      @click="startLogin"
      class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-card transition-colors"
      :disabled="busy"
      :aria-busy="busy.toString()"
      title="Conectar wallet (Wander/ArConnect)">
      <WalletIcon class="w-4 h-4" />
      <span class="btn-label">{{ busy ? '...' : 'Login' }}</span>
    </button>

    <div
      v-else
      class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm bg-[var(--bg-card)]/60 backdrop-blur-sm"
      :title="'Wallet: ' + session.state.address">
      <WsStatusDot
        :connected="walletConnected"
        size="sm"
        sr-label="Estado de la sesión de wallet" />
      <WalletIcon class="w-4 h-4 opacity-80" />
      <span class="font-mono truncate max-w-[110px]" aria-label="Dirección wallet">{{
        shortAddr
      }}</span>
      <span v-if="balanceLabel" class="balance-label text-xs font-mono opacity-80">{{
        balanceLabel
      }}</span>
    </div>
    <div v-if="error" class="absolute top-full mt-1 text-xs text-red-500 w-48">{{ error }}</div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue';
import { useWanderSession } from '../wander/store/wanderSession';
import { getWalletProvider } from '../wander/provider/walletProvider';
import { fetchJson } from '../services/api';
import WalletIcon from './icons/WalletIcon.vue';
import WsStatusDot from './WsStatusDot.vue';

const session = useWanderSession();
const busy = ref(false);
const error = ref('');
let providerPromise = null;

const walletConnected = computed(() => !!session.state.address && !session.state.sessionStale);

const shortAddr = computed(() => {
  if (!session.state.address) return '';
  return session.state.address.slice(0, 5) + '...' + session.state.address.slice(-5);
});

async function ensureProvider() {
  if (!providerPromise) providerPromise = getWalletProvider();
  return providerPromise;
}

async function startLogin() {
  error.value = '';
  busy.value = true;
  try {
    const provider = await ensureProvider();
    if (!provider.hasProvider) throw new Error('Extension not detected');

    await provider.ensurePermissions([
      'ACCESS_ADDRESS',
      'ACCESS_PUBLIC_KEY',
      'SIGN_MESSAGE',
      'SIGNATURE',
    ]);
    const address = await provider.getActiveAddress();
    if (!address) throw new Error('No se obtuvo dirección');
    const nonce = await fetchJson('/api/auth/wander/nonce', { method: 'POST', body: { address } });
    if (nonce.error) throw new Error(nonce.error);

    try {
      if (window.GETTY_WALLET_AUTH_DEBUG === '1') {
        const enc = new TextEncoder();
        const bytes = enc.encode(nonce.message || '');
        const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
        const h = Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        window.__wanderDebug = window.__wanderDebug || {};
        window.__wanderDebug.clientMsgHash = h;
        console.warn('[wallet-login-debug] message sha256', h.slice(0, 32), 'len', bytes.length);
      }
    } catch {}
    let primarySig = await provider.signMessage(nonce.message);
    let verify = await fetchJson('/api/auth/wander/verify', {
      method: 'POST',
      body: {
        address,
        signature: primarySig.signature,
        publicKey: primarySig.publicKey,
        strategy: primarySig.strategy,
        method: primarySig.method,
      },
    });
    if (!verify.success && verify.error === 'bad_signature') {
      try {
        const altMessage = String(nonce.message);
        const altSig = await provider.signMessage(altMessage);
        verify = await fetchJson('/api/auth/wander/verify', {
          method: 'POST',
          body: {
            address,
            signature: altSig.signature,
            publicKey: altSig.publicKey,
            strategy: altSig.strategy,
            method: altSig.method,
          },
        });
      } catch {}
    }
    if (!verify.success) throw new Error(verify.error || 'verify_failed');
    await session.refreshSession();
  } catch (e) {
    error.value = e.message || String(e);
  } finally {
    busy.value = false;
  }
}

const balanceLabel = computed(() => {
  if (!session.state.address) return '';
  return '';
});
</script>
<style scoped>
button {
  background: var(--bg-card);
}
button:hover {
  background: var(--bg-chat);
}
.balance-label {
  display: inline-block;
}
</style>
