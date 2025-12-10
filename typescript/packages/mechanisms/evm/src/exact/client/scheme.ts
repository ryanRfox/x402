import { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from "@x402/core/types";
import { getAddress, keccak256, toHex, stringToBytes } from "viem";
import { authorizationTypes } from "../../constants";
import {
  PERMIT2_ADDRESS,
  permit2WitnessTypes,
  getX402SettlementAddresses,
} from "../../permit2/constants";
import { ClientEvmSigner } from "../../signer";
import {
  AssetTransferMethod,
  ExactEIP3009Payload,
  ExactPermit2Payload,
  ExactEvmPayloadV2,
  PaymentOrder,
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
 * - `permit2`: Uniswap Permit2 with settlement contract (works with ANY ERC-20)
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
   * - `permit2`: Uses Permit2 with settlement contract (trust-minimized)
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
   * Create Permit2 SignatureTransfer payload with settlement contract
   *
   * This method creates a trust-minimized signature that includes the recipient address
   * via a PaymentOrder witness, preventing the facilitator from redirecting funds.
   *
   * The signature is over PermitWitnessTransferFrom with:
   * - Spender: Settlement contract address (NOT facilitator)
   * - Witness: PaymentOrder struct (includes recipient and paymentId)
   */
  private async createPermit2Payload(
    paymentRequirements: PaymentRequirements,
  ): Promise<ExactPermit2Payload> {
    const nonce = generatePermit2Nonce();
    const now = Math.floor(Date.now() / 1000);
    const deadline = BigInt(now + paymentRequirements.maxTimeoutSeconds);

    // Get settlement contract address for this network (lazy-loaded to support env vars)
    const settlementAddress = getX402SettlementAddresses()[paymentRequirements.network];
    if (!settlementAddress || settlementAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error(
        `Settlement contract not deployed on network ${paymentRequirements.network}. ` +
          `Deploy settlement contract first or use EIP-3009 for supported tokens.`,
      );
    }

    // Generate paymentId from resource URL
    const resourceUrl = paymentRequirements.extra?.resourceUrl as string | undefined;
    const paymentId = resourceUrl
      ? (keccak256(stringToBytes(resourceUrl)) as `0x${string}`)
      : (keccak256(stringToBytes("x402-payment")) as `0x${string}`);

    // Build the PaymentOrder witness
    const paymentOrder: PaymentOrder = {
      token: getAddress(paymentRequirements.asset),
      amount: BigInt(paymentRequirements.amount),
      recipient: getAddress(paymentRequirements.payTo),
      paymentId,
      nonce,
      deadline,
    };

    const signature = await this.signPermit2WitnessTransfer(
      paymentOrder,
      settlementAddress,
      paymentRequirements,
    );

    return {
      token: getAddress(paymentRequirements.asset),
      amount: paymentRequirements.amount,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      owner: this.signer.address,
      recipient: getAddress(paymentRequirements.payTo),
      paymentId,
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
   * Sign the Permit2 PermitWitnessTransferFrom message using EIP-712
   *
   * This creates a trust-minimized signature that includes the recipient address
   * via a PaymentOrder witness, preventing the facilitator from redirecting funds.
   *
   * The signature covers:
   * - Token and amount (in permitted)
   * - Settlement contract address (in spender)
   * - Nonce and deadline
   * - PaymentOrder witness (includes recipient, paymentId)
   *
   * @param paymentOrder - The payment order to sign (includes recipient)
   * @param settlementContract - The settlement contract address (spender)
   * @param requirements - The payment requirements
   * @returns EIP-712 signature over PermitWitnessTransferFrom
   */
  private async signPermit2WitnessTransfer(
    paymentOrder: PaymentOrder,
    settlementContract: `0x${string}`,
    requirements: PaymentRequirements,
  ): Promise<`0x${string}`> {
    const chainId = parseInt(requirements.network.split(":")[1]);

    // Permit2 EIP-712 domain
    const domain = {
      name: "Permit2",
      chainId,
      verifyingContract: PERMIT2_ADDRESS,
    };

    // Build the PermitWitnessTransferFrom message
    const message = {
      permitted: {
        token: paymentOrder.token,
        amount: paymentOrder.amount,
      },
      spender: settlementContract,
      nonce: paymentOrder.nonce,
      deadline: paymentOrder.deadline,
      witness: paymentOrder,
    };

    return await this.signer.signTypedData({
      domain,
      types: permit2WitnessTypes,
      primaryType: "PermitWitnessTransferFrom",
      message,
    });
  }
}
