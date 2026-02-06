/** Testnet asset addresses by symbol and CAIP-2 network */
export const TESTNET_ASSETS: Record<string, Record<string, string>> = {
  USDC: {
    'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
    'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Solana Devnet
  },
  WETH: {
    'eip155:84532': '0x4200000000000000000000000000000000000006', // Base Sepolia
  },
};

/** Resolve a symbol to all known addresses across networks */
export function resolveAssetAddresses(symbol: string): string[] {
  const networks = TESTNET_ASSETS[symbol.toUpperCase()];
  return networks ? Object.values(networks) : [];
}
