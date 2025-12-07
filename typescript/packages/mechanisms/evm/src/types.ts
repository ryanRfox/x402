/**
 * Asset transfer methods supported by the exact EVM scheme.
 *
 * - `eip3009`: EIP-3009 TransferWithAuthorization (default, requires token support)
 * - `permit2`: Uniswap Permit2 SignatureTransfer (works with ANY ERC-20)
 */
export type AssetTransferMethod = "eip3009" | "permit2";

/**
 * EIP-3009 TransferWithAuthorization payload
 */
export type ExactEIP3009Payload = {
  signature?: `0x${string}`;
  authorization: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: `0x${string}`;
  };
};

/**
 * Permit2 SignatureTransfer payload
 */
export type ExactPermit2Payload = {
  /** The token contract address */
  token: `0x${string}`;
  /** The amount to transfer (in token units) */
  amount: string;
  /** Unique nonce for this signature (non-sequential, bitmap-based) */
  nonce: string;
  /** Unix timestamp deadline for the signature */
  deadline: string;
  /** The token owner (payer) address */
  owner: `0x${string}`;
  /** The EIP-712 signature over the Permit2 SignatureTransfer message */
  signature: `0x${string}`;
};

export type ExactEvmPayloadV1 = ExactEIP3009Payload;

/**
 * V2 payload can be either EIP-3009 or Permit2, determined by assetTransferMethod in requirements.extra
 */
export type ExactEvmPayloadV2 = ExactEIP3009Payload | ExactPermit2Payload;

/**
 * Type guard to check if payload is Permit2
 */
export function isPermit2Payload(payload: ExactEvmPayloadV2): payload is ExactPermit2Payload {
  return "token" in payload && "owner" in payload && "deadline" in payload;
}

/**
 * Type guard to check if payload is EIP-3009
 */
export function isEIP3009Payload(payload: ExactEvmPayloadV2): payload is ExactEIP3009Payload {
  return "authorization" in payload;
}
