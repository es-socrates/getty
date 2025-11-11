/// <reference types="vite/client" />

import type { WalletLoadedEvent, WalletSwitchEvent, WalletDisconnectedEvent } from './src/wander/provider/walletTypes';

declare global {
  interface WindowEventMap {
    arweaveWalletLoaded: WalletLoadedEvent;
    walletSwitch: WalletSwitchEvent;
    walletDisconnected: WalletDisconnectedEvent;
  }
}
