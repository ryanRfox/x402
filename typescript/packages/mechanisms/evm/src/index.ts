/**
 * @module @x402/evm - x402 Payment Protocol EVM Implementation
 *
 * This module provides the EVM-specific implementation of the x402 payment protocol.
 */

export { ExactEvmScheme } from "./exact";
export { toClientEvmSigner, toFacilitatorEvmSigner } from "./signer";
export type { ClientEvmSigner, FacilitatorEvmSigner } from "./signer";

// Permit2 constants (used by exact scheme with assetTransferMethod: "permit2")
export { PERMIT2_ADDRESS, permit2Types, permit2ABI, erc20ABI } from "./permit2/constants";
