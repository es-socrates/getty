export type PermissionName =
  | 'ACCESS_ADDRESS'
  | 'ACCESS_PUBLIC_KEY'
  | 'SIGN_MESSAGE'
  | 'SIGNATURE'
  | 'SIGN_TRANSACTION'
  | 'DISPATCH';

export interface WalletSignature {
  signature: string;
  publicKey: string;
  strategy: string | null;
  method: string | null;
}

export type WalletEvent = 'account-changed' | 'disconnected';
export type WalletEventListener = (event: WalletEvent, payload: unknown) => void;

export interface WalletAdapter {
  hasProvider: boolean;
  on(listener: WalletEventListener): () => void;
  ensurePermissions(minimal?: PermissionName[]): Promise<void>;
  getActiveAddress(): Promise<string>;
  getActivePublicKey(): Promise<string>;
  disconnect(): Promise<void>;
  signMessage(message: unknown): Promise<WalletSignature>;
}

export interface WalletLoadedEventDetail {
  permissions: PermissionName[];
}

export interface WalletSwitchEventDetail {
  address: string;
}

export interface WalletDisconnectedEventDetail {
  address?: string;
  reason?: string;
}

export type WalletLoadedEvent = CustomEvent<WalletLoadedEventDetail>;
export type WalletSwitchEvent = CustomEvent<WalletSwitchEventDetail>;
export type WalletDisconnectedEvent = CustomEvent<WalletDisconnectedEventDetail>;

export interface RawWalletProvider {
  connect?(permissions: PermissionName[]): Promise<void>;
  connectPermissions?(permissions: PermissionName[]): Promise<void>;
  getPermissions?(): Promise<PermissionName[]>;
  getActiveAddress?(): Promise<string>;
  getAddress?(): Promise<string>;
  address?: string;
  getActivePublicKey?(): Promise<string>;
  getPublicKey?(): Promise<string>;
  getOwner?(): Promise<string>;
  disconnect?(): Promise<void>;
  signMessage?(
    data: unknown
  ): Promise<Uint8Array | ArrayBuffer | string | null | undefined>;
  verifyMessage?(data: unknown, signature: Uint8Array | ArrayBuffer | string): Promise<boolean>;
}

export const MINIMUM_WALLET_PERMISSIONS: readonly PermissionName[] = [
  'ACCESS_ADDRESS',
  'ACCESS_PUBLIC_KEY',
  'SIGN_MESSAGE',
  'SIGNATURE'
];

export const EXTENDED_WALLET_PERMISSIONS: readonly PermissionName[] = [
  ...MINIMUM_WALLET_PERMISSIONS,
  'SIGN_TRANSACTION'
];

declare global {
  interface Window {
    wander?: RawWalletProvider;
    arweaveWallet?: RawWalletProvider;
    arconnect?: RawWalletProvider;
    __wanderDebug?: Record<string, unknown>;
    GETTY_WALLET_AUTH_DEBUG?: '0' | '1';
    __GETTY_DUMMY_WALLET?: boolean;
  }
}

export {};
