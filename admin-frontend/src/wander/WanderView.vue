<template>
  <div class="p-4 space-y-6">
    <WanderAuthPanel />
    <div v-if="session.state.address" class="text-sm text-neutral-600 dark:text-neutral-400">
      With active session, settings and sockets are isolated by
      <code class="font-mono">{{ session.state.walletHash }}</code
      >.
    </div>
  </div>
</template>
<script setup>
import WanderAuthPanel from './components/WanderAuthPanel.vue';
import { useWanderSession } from './store/wanderSession';
const session = useWanderSession();
</script>
