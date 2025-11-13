/// <reference types="vite/client" />

import type { WalletLoadedEvent, WalletSwitchEvent, WalletDisconnectedEvent } from './src/wander/provider/walletTypes';
import type { WanderConnect } from '@wanderapp/connect';

declare global {
  interface WindowEventMap {
    arweaveWalletLoaded: WalletLoadedEvent;
    walletSwitch: WalletSwitchEvent;
    walletDisconnected: WalletDisconnectedEvent;
  }

  interface Window {
    wanderInstance?: WanderConnect;
  }
}
