import { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from "@x402/core/types";
import { getAddress, toHex } from "viem";
import { authorizationTypes } from "../../constants";
import { PERMIT2_ADDRESS, permit2Types } from "../../permit2/constants";
import { ClientEvmSigner } from "../../signer";
import {
  AssetTransferMethod,
  ExactEIP3009Payload,
  ExactPermit2Payload,
  ExactEvmPayloadV2,
} from "../../types";
import { createNonce } from "../../utils";

/**
 * Generate a random nonce for Permit2 SignatureTransfer
 * Permit2 uses unordered nonces (bitmap-based), so any unique value works
 */
function generatePermit2Nonce(): bigint {
  const randomBytes = new Uint8Array(32);
  if (typeof globalThis.crypto !== "undefined") {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 32; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return BigInt(toHex(randomBytes));
}

/**
 * EVM client implementation for the Exact payment scheme.
 *
 * Supports multiple asset transfer methods:
 * - `eip3009` (default): EIP-3009 TransferWithAuthorization (requires token support)
 * - `permit2`: Uniswap Permit2 SignatureTransfer (works with ANY ERC-20)
 *
 * The transfer method is determined by `extra.assetTransferMethod` in payment requirements.
 */
export class ExactEvmScheme implements SchemeNetworkClient {
  readonly scheme = "exact";

  /**
   * Creates a new ExactEvmClient instance.
   *
   * @param signer - The EVM signer for client operations
   */
  constructor(private readonly signer: ClientEvmSigner) {}

  /**
   * Creates a payment payload for the Exact scheme.
   *
   * Dispatches to the appropriate transfer method based on `extra.assetTransferMethod`:
   * - `eip3009` (default): Uses EIP-3009 TransferWithAuthorization
   * - `permit2`: Uses Uniswap Permit2 SignatureTransfer
   *
   * @param x402Version - The x402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "x402Version" | "payload">> {
    const transferMethod = (paymentRequirements.extra?.assetTransferMethod as AssetTransferMethod) || "eip3009";

    let payload: ExactEvmPayloadV2;

    switch (transferMethod) {
      case "permit2":
        payload = await this.createPermit2Payload(paymentRequirements);
        break;
      case "eip3009":
      default:
        payload = await this.createEIP3009Payload(paymentRequirements);
        break;
    }

    return {
      x402Version,
      payload,
    };
  }

  /**
   * Create EIP-3009 TransferWithAuthorization payload
   */
  private async createEIP3009Payload(
    paymentRequirements: PaymentRequirements,
  ): Promise<ExactEIP3009Payload> {
    const nonce = createNonce();
    const now = Math.floor(Date.now() / 1000);

    const authorization: ExactEIP3009Payload["authorization"] = {
      from: this.signer.address,
      to: getAddress(paymentRequirements.payTo),
      value: paymentRequirements.amount,
      validAfter: (now - 600).toString(), // 10 minutes before
      validBefore: (now + paymentRequirements.maxTimeoutSeconds).toString(),
      nonce,
    };

    const signature = await this.signEIP3009Authorization(authorization, paymentRequirements);

    return {
      authorization,
      signature,
    };
  }

  /**
   * Create Permit2 SignatureTransfer payload
   */
  private async createPermit2Payload(
    paymentRequirements: PaymentRequirements,
  ): Promise<ExactPermit2Payload> {
    const nonce = generatePermit2Nonce();
    const now = Math.floor(Date.now() / 1000);
    const deadline = BigInt(now + paymentRequirements.maxTimeoutSeconds);

    // The facilitator address is who will call Permit2.permitTransferFrom()
    // It should be provided in extra.facilitator, or we use payTo as fallback
    const spenderAddress = paymentRequirements.extra?.facilitator
      ? getAddress(paymentRequirements.extra.facilitator as string)
      : getAddress(paymentRequirements.payTo);

    const signature = await this.signPermit2Transfer(
      getAddress(paymentRequirements.asset),
      BigInt(paymentRequirements.amount),
      spenderAddress,
      nonce,
      deadline,
      paymentRequirements,
    );

    return {
      token: getAddress(paymentRequirements.asset),
      amount: paymentRequirements.amount,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      owner: this.signer.address,
      signature,
    };
  }

  /**
   * Sign the EIP-3009 authorization using EIP-712
   */
  private async signEIP3009Authorization(
    authorization: ExactEIP3009Payload["authorization"],
    requirements: PaymentRequirements,
  ): Promise<`0x${string}`> {
    const chainId = parseInt(requirements.network.split(":")[1]);

    if (!requirements.extra?.name || !requirements.extra?.version) {
      throw new Error(
        `EIP-712 domain parameters (name, version) are required in payment requirements for asset ${requirements.asset}`,
      );
    }

    const { name, version } = requirements.extra;

    const domain = {
      name,
      version,
      chainId,
      verifyingContract: getAddress(requirements.asset),
    };

    const message = {
      from: getAddress(authorization.from),
      to: getAddress(authorization.to),
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    };

    return await this.signer.signTypedData({
      domain,
      types: authorizationTypes,
      primaryType: "TransferWithAuthorization",
      message,
    });
  }

  /**
   * Sign the Permit2 SignatureTransfer message using EIP-712
   */
  private async signPermit2Transfer(
    token: `0x${string}`,
    amount: bigint,
    spender: `0x${string}`,
    nonce: bigint,
    deadline: bigint,
    requirements: PaymentRequirements,
  ): Promise<`0x${string}`> {
    const chainId = parseInt(requirements.network.split(":")[1]);

    // Permit2 EIP-712 domain - note: no version field
    const domain = {
      name: "Permit2",
      chainId,
      verifyingContract: PERMIT2_ADDRESS,
    };

    const message = {
      permitted: {
        token,
        amount,
      },
      spender,
      nonce,
      deadline,
    };

    return await this.signer.signTypedData({
      domain,
      types: permit2Types,
      primaryType: "PermitTransferFrom",
      message,
    });
  }
}
