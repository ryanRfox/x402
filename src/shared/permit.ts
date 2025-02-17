import { WalletClient, Hex, toHex } from "viem";
import { config } from "./config";
import { AuthorizationParameters } from "../types";
import { PaymentPayloadV1 } from "./types";
import { z } from "zod";

export const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
  // EIP712Domain: [
  //   { name: "name", type: "string" },
  //   { name: "version", type: "string" },
  //   { name: "chainId", type: "uint256" },
  //   { name: "verifyingContract", type: "address" },
  // ],
};

export const authorizationPrimaryType = "TransferWithAuthorization";

/**
 * Signs an EIP-3009 authorization for USDC transfer
 * @param walletClient - The wallet client that will sign the authorization
 * @param params - The authorization parameters
 * @param params.from - The address tokens will be transferred from
 * @param params.to - The address tokens will be transferred to
 * @param params.value - The amount of USDC tokens to transfer (in base units)
 * @param params.validAfter - Unix timestamp after which the authorization becomes valid
 * @param params.validBefore - Unix timestamp before which the authorization is valid
 * @param params.nonce - Random 32-byte nonce to prevent replay attacks
 * @param params.chainId - The chain ID where the USDC contract exists
 * @param params.version - The USDC contract version
 * @param params.usdcAddress - The address of the USDC contract
 * @returns The signature for the authorization
 */
export async function signAuthorization(
  walletClient: WalletClient,
  {
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    chainId,
    version,
    usdcAddress,
  }: AuthorizationParameters
): Promise<{ signature: Hex }> {
  const usdcName = config[chainId].usdcName;

  const data = {
    account: walletClient.account!,
    types: authorizationTypes,
    domain: {
      name: usdcName,
      version: version,
      chainId: chainId,
      verifyingContract: usdcAddress,
    },
    primaryType: authorizationPrimaryType,
    message: {
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce: nonce,
    },
  };

  const signature = await walletClient.signTypedData(data);

  return {
    signature,
  };
}

export function createNonce(): Hex {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export function encodePayment(payment: PaymentPayloadV1): string {
  const safe = {
    ...payment,
    payload: {
      ...payment.payload,
      params: Object.fromEntries(
        Object.entries(payment.payload.params).map(([key, value]) => [
          key,
          typeof value === "bigint" ? value.toString() : value,
        ])
      ),
    },
  };
  return safeBase64Encode(JSON.stringify(safe));
}

export function decodePayment(payment: string): PaymentPayloadV1 {
  // TODO: setup proper zod validation
  const decoded = safeBase64Decode(payment);
  const parsed = JSON.parse(decoded);

  const withBigInts = {
    ...parsed,
    payload: {
      ...parsed.payload,
      params: {
        ...parsed.payload.params,
        value: BigInt(parsed.payload.params.value),
        validAfter: BigInt(parsed.payload.params.validAfter),
        validBefore: BigInt(parsed.payload.params.validBefore),
        nonce: parsed.payload.params.nonce,
      },
    },
  };

  return withBigInts as PaymentPayloadV1;
}

function safeBase64Encode(data: string): string {
  if (typeof window !== "undefined") {
    return window.btoa(data);
  }
  return Buffer.from(data).toString("base64");
}

function safeBase64Decode(data: string): string {
  if (typeof window !== "undefined") {
    return window.atob(data);
  }
  return Buffer.from(data, "base64").toString("utf-8");
}
