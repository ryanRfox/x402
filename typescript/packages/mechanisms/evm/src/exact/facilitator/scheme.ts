import {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { getAddress, Hex, isAddressEqual, parseErc6492Signature, parseSignature, recoverTypedDataAddress } from "viem";
import { authorizationTypes, eip3009ABI } from "../../constants";
import { PERMIT2_ADDRESS, erc20ABI, getX402SettlementAddresses, x402SettlementABI, permit2WitnessTypes } from "../../permit2/constants";
import { FacilitatorEvmSigner } from "../../signer";
import {
  ExactEIP3009Payload,
  ExactPermit2Payload,
  ExactEvmPayloadV2,
  isPermit2Payload,
  isEIP3009Payload,
} from "../../types";

export interface ExactEvmSchemeConfig {
  /**
   * If enabled, the facilitator will deploy ERC-4337 smart wallets
   * via EIP-6492 when encountering undeployed contract signatures.
   *
   * @default false
   */
  deployERC4337WithEIP6492?: boolean;
}

/**
 * EVM facilitator implementation for the Exact payment scheme.
 *
 * Supports multiple asset transfer methods:
 * - `eip3009` (default): EIP-3009 TransferWithAuthorization (requires token support)
 * - `permit2`: Uniswap Permit2 via settlement contract (trust-minimized, works with ANY ERC-20)
 *
 * The transfer method is determined by `extra.assetTransferMethod` in payment requirements,
 * or auto-detected from the payload structure.
 */
export class ExactEvmScheme implements SchemeNetworkFacilitator {
  readonly scheme = "exact";
  readonly caipFamily = "eip155:*";
  private readonly config: Required<ExactEvmSchemeConfig>;

  /**
   * Creates a new ExactEvmFacilitator instance.
   *
   * @param signer - The EVM signer for facilitator operations
   * @param config - Optional configuration for the facilitator
   */
  constructor(
    private readonly signer: FacilitatorEvmSigner,
    config?: ExactEvmSchemeConfig,
  ) {
    this.config = {
      deployERC4337WithEIP6492: config?.deployERC4337WithEIP6492 ?? false,
    };
  }

  /**
   * Get mechanism-specific extra data for the supported kinds endpoint.
   * Returns Permit2 and settlement contract addresses.
   *
   * @param network - The network identifier (CAIP-2 format)
   * @returns Extra data including Permit2 and settlement contract addresses
   */
  getExtra(network: string): Record<string, unknown> | undefined {
    const settlementContract = getX402SettlementAddresses()[network];
    return {
      permit2Address: PERMIT2_ADDRESS,
      settlementContract: settlementContract || undefined,
    };
  }

  /**
   * Get signer addresses used by this facilitator.
   * Returns all addresses this facilitator can use for signing/settling transactions.
   *
   * @param _ - The network identifier (unused for EVM, addresses are network-agnostic)
   * @returns Array of facilitator wallet addresses
   */
  getSigners(_: string): string[] {
    return [...this.signer.getAddresses()];
  }

  /**
   * Verifies a payment payload.
   *
   * Dispatches to the appropriate verification method based on payload structure:
   * - Permit2 payloads (have `token`, `owner`, `deadline`, `recipient`, `paymentId`)
   * - EIP-3009 payloads (have `authorization`)
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements
   * @returns Promise resolving to verification response
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const exactEvmPayload = payload.payload as ExactEvmPayloadV2;

    // Verify scheme matches
    if (payload.accepted.scheme !== "exact" || requirements.scheme !== "exact") {
      const payer = isPermit2Payload(exactEvmPayload)
        ? exactEvmPayload.owner
        : (exactEvmPayload as ExactEIP3009Payload).authorization.from;
      return {
        isValid: false,
        invalidReason: "unsupported_scheme",
        payer,
      };
    }

    // Verify network matches
    if (payload.accepted.network !== requirements.network) {
      const payer = isPermit2Payload(exactEvmPayload)
        ? exactEvmPayload.owner
        : (exactEvmPayload as ExactEIP3009Payload).authorization.from;
      return {
        isValid: false,
        invalidReason: "network_mismatch",
        payer,
      };
    }

    // Dispatch based on payload type
    if (isPermit2Payload(exactEvmPayload)) {
      return this.verifyPermit2(exactEvmPayload, requirements);
    } else if (isEIP3009Payload(exactEvmPayload)) {
      return this.verifyEIP3009(exactEvmPayload, requirements);
    } else {
      return {
        isValid: false,
        invalidReason: "unknown_payload_type",
        payer: "unknown",
      };
    }
  }

  /**
   * Verify EIP-3009 TransferWithAuthorization payload
   */
  private async verifyEIP3009(
    exactEvmPayload: ExactEIP3009Payload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    // Get chain configuration
    if (!requirements.extra?.name || !requirements.extra?.version) {
      return {
        isValid: false,
        invalidReason: "missing_eip712_domain",
        payer: exactEvmPayload.authorization.from,
      };
    }

    const { name, version } = requirements.extra;
    const erc20Address = getAddress(requirements.asset);

    // Build typed data for signature verification
    const permitTypedData = {
      types: authorizationTypes,
      primaryType: "TransferWithAuthorization" as const,
      domain: {
        name,
        version,
        chainId: parseInt(requirements.network.split(":")[1]),
        verifyingContract: erc20Address,
      },
      message: {
        from: exactEvmPayload.authorization.from,
        to: exactEvmPayload.authorization.to,
        value: BigInt(exactEvmPayload.authorization.value),
        validAfter: BigInt(exactEvmPayload.authorization.validAfter),
        validBefore: BigInt(exactEvmPayload.authorization.validBefore),
        nonce: exactEvmPayload.authorization.nonce,
      },
    };

    // Verify signature
    try {
      const recoveredAddress = await this.signer.verifyTypedData({
        address: exactEvmPayload.authorization.from,
        ...permitTypedData,
        signature: exactEvmPayload.signature!,
      });

      if (!recoveredAddress) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_evm_payload_signature",
          payer: exactEvmPayload.authorization.from,
        };
      }
    } catch {
      // Signature verification failed - could be an undeployed smart wallet
      // Check if smart wallet is deployed
      const signature = exactEvmPayload.signature!;
      const signatureLength = signature.startsWith("0x") ? signature.length - 2 : signature.length;
      const isSmartWallet = signatureLength > 130; // 65 bytes = 130 hex chars for EOA

      if (isSmartWallet) {
        const payerAddress = exactEvmPayload.authorization.from;
        const bytecode = await this.signer.getCode({ address: payerAddress });

        if (!bytecode || bytecode === "0x") {
          // Wallet is not deployed. Check if it's EIP-6492 with deployment info.
          // EIP-6492 signatures contain factory address and calldata needed for deployment.
          // Non-EIP-6492 undeployed wallets cannot succeed (no way to deploy them).
          const erc6492Data = parseErc6492Signature(signature);
          const hasDeploymentInfo =
            erc6492Data.address &&
            erc6492Data.data &&
            !isAddressEqual(erc6492Data.address, "0x0000000000000000000000000000000000000000");

          if (!hasDeploymentInfo) {
            // Non-EIP-6492 undeployed smart wallet - will always fail at settlement
            // since EIP-3009 requires on-chain EIP-1271 validation
            return {
              isValid: false,
              invalidReason: "invalid_exact_evm_payload_undeployed_smart_wallet",
              payer: payerAddress,
            };
          }
          // EIP-6492 signature with deployment info - allow through
          // Facilitators with sponsored deployment support can handle this in settle()
        } else {
          // Wallet is deployed but signature still failed - invalid signature
          return {
            isValid: false,
            invalidReason: "invalid_exact_evm_payload_signature",
            payer: exactEvmPayload.authorization.from,
          };
        }
      } else {
        // EOA signature failed
        return {
          isValid: false,
          invalidReason: "invalid_exact_evm_payload_signature",
          payer: exactEvmPayload.authorization.from,
        };
      }
    }

    // Verify payment recipient matches
    if (getAddress(exactEvmPayload.authorization.to) !== getAddress(requirements.payTo)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_recipient_mismatch",
        payer: exactEvmPayload.authorization.from,
      };
    }

    // Verify validBefore is in the future (with 6 second buffer for block time)
    const now = Math.floor(Date.now() / 1000);
    if (BigInt(exactEvmPayload.authorization.validBefore) < BigInt(now + 6)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_authorization_valid_before",
        payer: exactEvmPayload.authorization.from,
      };
    }

    // Verify validAfter is not in the future
    if (BigInt(exactEvmPayload.authorization.validAfter) > BigInt(now)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_authorization_valid_after",
        payer: exactEvmPayload.authorization.from,
      };
    }

    // Check balance
    try {
      const balance = (await this.signer.readContract({
        address: erc20Address,
        abi: eip3009ABI,
        functionName: "balanceOf",
        args: [exactEvmPayload.authorization.from],
      })) as bigint;

      if (BigInt(balance) < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: "insufficient_funds",
          payer: exactEvmPayload.authorization.from,
        };
      }
    } catch {
      // If we can't check balance, continue with other validations
    }

    // Verify amount is sufficient
    if (BigInt(exactEvmPayload.authorization.value) < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_authorization_value",
        payer: exactEvmPayload.authorization.from,
      };
    }

    return {
      isValid: true,
      invalidReason: undefined,
      payer: exactEvmPayload.authorization.from,
    };
  }

  /**
   * Verify Permit2 SignatureTransfer payload with settlement contract
   */
  private async verifyPermit2(
    permit2Payload: ExactPermit2Payload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const chainId = parseInt(requirements.network.split(":")[1]);

    // Verify token matches
    if (getAddress(permit2Payload.token) !== getAddress(requirements.asset)) {
      return {
        isValid: false,
        invalidReason: "token_mismatch",
        payer: permit2Payload.owner,
      };
    }

    // Verify recipient matches
    if (getAddress(permit2Payload.recipient) !== getAddress(requirements.payTo)) {
      return {
        isValid: false,
        invalidReason: "recipient_mismatch",
        payer: permit2Payload.owner,
      };
    }

    // Get settlement contract address for this network (lazy-loaded to support env vars)
    const settlementContract = getX402SettlementAddresses()[requirements.network];
    if (!settlementContract || settlementContract === "0x0000000000000000000000000000000000000000") {
      return {
        isValid: false,
        invalidReason: "settlement_contract_not_deployed",
        payer: permit2Payload.owner,
      };
    }

    // Build the EIP-712 domain and message for verification
    const domain = {
      name: "Permit2",
      chainId,
      verifyingContract: PERMIT2_ADDRESS,
    };

    // Build the payment order (witness data)
    const paymentOrder = {
      token: getAddress(permit2Payload.token),
      amount: BigInt(permit2Payload.amount),
      recipient: getAddress(permit2Payload.recipient),
      paymentId: permit2Payload.paymentId,
      nonce: BigInt(permit2Payload.nonce),
      deadline: BigInt(permit2Payload.deadline),
    };

    // The spender in Permit2 signature is the settlement contract
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

    // Verify signature with witness
    try {
      const recoveredAddress = await recoverTypedDataAddress({
        domain,
        types: permit2WitnessTypes,
        primaryType: "PermitWitnessTransferFrom",
        message,
        signature: permit2Payload.signature,
      });

      if (getAddress(recoveredAddress) !== getAddress(permit2Payload.owner)) {
        return {
          isValid: false,
          invalidReason: "invalid_permit2_signature",
          payer: permit2Payload.owner,
        };
      }
    } catch {
      return {
        isValid: false,
        invalidReason: "invalid_permit2_signature",
        payer: permit2Payload.owner,
      };
    }

    // Verify deadline is in the future (with buffer for block time)
    const now = Math.floor(Date.now() / 1000);
    if (BigInt(permit2Payload.deadline) < BigInt(now + 6)) {
      return {
        isValid: false,
        invalidReason: "permit2_deadline_expired",
        payer: permit2Payload.owner,
      };
    }

    // Verify amount is sufficient
    if (BigInt(permit2Payload.amount) < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: "insufficient_amount",
        payer: permit2Payload.owner,
      };
    }

    // Check payer's token balance
    try {
      const balance = (await this.signer.readContract({
        address: getAddress(permit2Payload.token),
        abi: erc20ABI,
        functionName: "balanceOf",
        args: [permit2Payload.owner],
      })) as bigint;

      if (balance < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: "insufficient_funds",
          payer: permit2Payload.owner,
        };
      }
    } catch {
      // If balance check fails, continue - will fail at settlement if funds are insufficient
    }

    // Check payer's Permit2 allowance
    try {
      const allowance = (await this.signer.readContract({
        address: getAddress(permit2Payload.token),
        abi: erc20ABI,
        functionName: "allowance",
        args: [permit2Payload.owner, PERMIT2_ADDRESS],
      })) as bigint;

      if (allowance < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: "insufficient_permit2_allowance",
          payer: permit2Payload.owner,
        };
      }
    } catch {
      // If allowance check fails, continue - will fail at settlement
    }

    return {
      isValid: true,
      invalidReason: undefined,
      payer: permit2Payload.owner,
    };
  }

  /**
   * Settles a payment by executing the transfer.
   *
   * Dispatches to the appropriate settlement method based on payload structure:
   * - Permit2 payloads use settlement contract's executePayment()
   * - EIP-3009 payloads use token.transferWithAuthorization()
   *
   * @param payload - The payment payload to settle
   * @param requirements - The payment requirements
   * @returns Promise resolving to settlement response
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const exactEvmPayload = payload.payload as ExactEvmPayloadV2;

    // Re-verify before settling
    const valid = await this.verify(payload, requirements);
    if (!valid.isValid) {
      const payer = isPermit2Payload(exactEvmPayload)
        ? exactEvmPayload.owner
        : (exactEvmPayload as ExactEIP3009Payload).authorization.from;
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: valid.invalidReason ?? "invalid_scheme",
        payer,
      };
    }

    // Dispatch based on payload type
    if (isPermit2Payload(exactEvmPayload)) {
      return this.settlePermit2(exactEvmPayload, payload, requirements);
    } else if (isEIP3009Payload(exactEvmPayload)) {
      return this.settleEIP3009(exactEvmPayload, payload, requirements);
    } else {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: "unknown_payload_type",
        payer: "unknown",
      };
    }
  }

  /**
   * Settle EIP-3009 TransferWithAuthorization payment
   */
  private async settleEIP3009(
    exactEvmPayload: ExactEIP3009Payload,
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    try {
      // Parse ERC-6492 signature if applicable
      const parseResult = parseErc6492Signature(exactEvmPayload.signature!);
      const { signature, address: factoryAddress, data: factoryCalldata } = parseResult;

      // Deploy ERC-4337 smart wallet via EIP-6492 if configured and needed
      if (
        this.config.deployERC4337WithEIP6492 &&
        factoryAddress &&
        factoryCalldata &&
        !isAddressEqual(factoryAddress, "0x0000000000000000000000000000000000000000")
      ) {
        // Check if smart wallet is already deployed
        const payerAddress = exactEvmPayload.authorization.from;
        const bytecode = await this.signer.getCode({ address: payerAddress });

        if (!bytecode || bytecode === "0x") {
          // Wallet not deployed - attempt deployment
          try {
            console.log(`Deploying ERC-4337 smart wallet for ${payerAddress} via EIP-6492`);

            // Send the factory calldata directly as a transaction
            // The factoryCalldata already contains the complete encoded function call
            const deployTx = await this.signer.sendTransaction({
              to: factoryAddress as Hex,
              data: factoryCalldata as Hex,
            });

            // Wait for deployment transaction
            await this.signer.waitForTransactionReceipt({ hash: deployTx });
            console.log(`Successfully deployed smart wallet for ${payerAddress}`);
          } catch (deployError) {
            console.error("Smart wallet deployment failed:", deployError);
            // Deployment failed - cannot proceed
            throw deployError;
          }
        } else {
          console.log(`Smart wallet for ${payerAddress} already deployed, skipping deployment`);
        }
      }

      // Determine if this is an ECDSA signature (EOA) or smart wallet signature
      // ECDSA signatures are exactly 65 bytes (130 hex chars without 0x)
      const signatureLength = signature.startsWith("0x") ? signature.length - 2 : signature.length;
      const isECDSA = signatureLength === 130;

      let tx: Hex;
      if (isECDSA) {
        // For EOA wallets, parse signature into v, r, s and use that overload
        const parsedSig = parseSignature(signature);

        tx = await this.signer.writeContract({
          address: getAddress(requirements.asset),
          abi: eip3009ABI,
          functionName: "transferWithAuthorization",
          args: [
            getAddress(exactEvmPayload.authorization.from),
            getAddress(exactEvmPayload.authorization.to),
            BigInt(exactEvmPayload.authorization.value),
            BigInt(exactEvmPayload.authorization.validAfter),
            BigInt(exactEvmPayload.authorization.validBefore),
            exactEvmPayload.authorization.nonce,
            (parsedSig.v as number | undefined) || parsedSig.yParity,
            parsedSig.r,
            parsedSig.s,
          ],
        });
      } else {
        // For smart wallets, use the bytes signature overload
        // The signature contains WebAuthn/P256 or other ERC-1271 compatible signature data
        tx = await this.signer.writeContract({
          address: getAddress(requirements.asset),
          abi: eip3009ABI,
          functionName: "transferWithAuthorization",
          args: [
            getAddress(exactEvmPayload.authorization.from),
            getAddress(exactEvmPayload.authorization.to),
            BigInt(exactEvmPayload.authorization.value),
            BigInt(exactEvmPayload.authorization.validAfter),
            BigInt(exactEvmPayload.authorization.validBefore),
            exactEvmPayload.authorization.nonce,
            signature,
          ],
        });
      }

      // Wait for transaction confirmation
      const receipt = await this.signer.waitForTransactionReceipt({ hash: tx });

      if (receipt.status !== "success") {
        return {
          success: false,
          errorReason: "invalid_transaction_state",
          transaction: tx,
          network: payload.accepted.network,
          payer: exactEvmPayload.authorization.from,
        };
      }

      return {
        success: true,
        transaction: tx,
        network: payload.accepted.network,
        payer: exactEvmPayload.authorization.from,
      };
    } catch (error) {
      console.error("Failed to settle EIP-3009 transaction:", error);
      return {
        success: false,
        errorReason: "transaction_failed",
        transaction: "",
        network: payload.accepted.network,
        payer: exactEvmPayload.authorization.from,
      };
    }
  }

  /**
   * Settle Permit2 SignatureTransfer payment via settlement contract
   *
   * Calls the settlement contract's executePayment function which:
   * 1. Validates the signature covers the payment order (including recipient)
   * 2. Calls Permit2 to transfer tokens to the settlement contract
   * 3. Transfers tokens from settlement contract to the validated recipient
   *
   * This prevents the facilitator from redirecting funds.
   */
  private async settlePermit2(
    permit2Payload: ExactPermit2Payload,
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    try {
      // Get settlement contract address (lazy-loaded to support env vars)
      const settlementContract = getX402SettlementAddresses()[requirements.network];
      if (!settlementContract || settlementContract === "0x0000000000000000000000000000000000000000") {
        return {
          success: false,
          errorReason: "settlement_contract_not_deployed",
          transaction: "",
          network: payload.accepted.network,
          payer: permit2Payload.owner,
        };
      }

      // Build the payment order
      const paymentOrder = {
        token: getAddress(permit2Payload.token),
        amount: BigInt(permit2Payload.amount),
        recipient: getAddress(permit2Payload.recipient),
        paymentId: permit2Payload.paymentId,
        nonce: BigInt(permit2Payload.nonce),
        deadline: BigInt(permit2Payload.deadline),
      };

      // Call settlement contract's executePayment function
      const tx = await this.signer.writeContract({
        address: settlementContract,
        abi: x402SettlementABI,
        functionName: "executePayment",
        args: [paymentOrder, permit2Payload.owner, permit2Payload.signature],
      });

      // Wait for transaction confirmation
      const receipt = await this.signer.waitForTransactionReceipt({ hash: tx });

      if (receipt.status !== "success") {
        return {
          success: false,
          errorReason: "transaction_failed",
          transaction: tx,
          network: payload.accepted.network,
          payer: permit2Payload.owner,
        };
      }

      return {
        success: true,
        transaction: tx,
        network: payload.accepted.network,
        payer: permit2Payload.owner,
      };
    } catch (error) {
      console.error("Failed to settle via settlement contract:", error);
      return {
        success: false,
        errorReason: "transaction_failed",
        transaction: "",
        network: payload.accepted.network,
        payer: permit2Payload.owner,
      };
    }
  }
}
