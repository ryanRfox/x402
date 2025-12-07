/**
 * @fileoverview Permit2 SDK Integration Test (via assetTransferMethod)
 *
 * Tests the x402 SDK's Permit2 support using assetTransferMethod:
 * - Uses scheme: "exact" with extra.assetTransferMethod: "permit2"
 * - Client creates Permit2 SignatureTransfer payloads
 * - Facilitator verifies signatures and settles via Permit2.permitTransferFrom()
 *
 * This demonstrates how ANY ERC-20 token can be used with x402 by specifying
 * assetTransferMethod: "permit2" in the payment requirements.
 *
 * Prerequisites:
 * - Anvil running: anvil (plain, no fork)
 * - Permit2 deployed (run setup from README.md)
 * - USDEMO token deployed and approved to Permit2
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { x402Client } from "@x402/core/client";
import { x402Facilitator } from "@x402/core/facilitator";
import { PaymentRequirements, PaymentRequired } from "@x402/core/types";
import { toClientEvmSigner, toFacilitatorEvmSigner } from "@x402/evm";
import { registerExactEvmScheme as registerExactEvmClientScheme } from "@x402/evm/exact/client";
import { registerExactEvmScheme as registerExactEvmFacilitatorScheme } from "@x402/evm/exact/facilitator";

import {
  PERMIT2_ADDRESS,
  USDEMO_ADDRESS,
  ANVIL_ACCOUNT_0,
  ANVIL_ACCOUNT_1,
  CHAIN_ID,
  ERC20_ABI,
} from "./constants.js";

// Custom chain definition for local Anvil
const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});

const transport = http("http://127.0.0.1:8545");

const publicClient = createPublicClient({
  chain: anvil,
  transport,
});

// Payer (client) - signs the Permit2 message
const payerAccount = privateKeyToAccount(ANVIL_ACCOUNT_0.privateKey);
const payerWalletClient = createWalletClient({
  account: payerAccount,
  chain: anvil,
  transport,
});

// Facilitator - executes the transfer
const facilitatorAccount = privateKeyToAccount(ANVIL_ACCOUNT_1.privateKey);
const facilitatorWalletClient = createWalletClient({
  account: facilitatorAccount,
  chain: anvil,
  transport,
});

/**
 * Gets the USDEMO token balance for an address.
 *
 * @param address - The address to check balance for
 * @returns The token balance in base units
 */
async function getBalance(address: `0x${string}`): Promise<bigint> {
  return publicClient.readContract({
    address: USDEMO_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });
}

/**
 * Main test function demonstrating x402 SDK with Permit2 via assetTransferMethod.
 */
async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Permit2 SDK Integration Test");
  console.log("=".repeat(60));
  console.log();

  // Payment details
  const paymentAmount = "100000000"; // 100 USDEMO (6 decimals)
  const recipient = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as `0x${string}`; // Anvil account 2

  console.log("Configuration:");
  console.log(`  Token:       ${USDEMO_ADDRESS}`);
  console.log(`  Permit2:     ${PERMIT2_ADDRESS}`);
  console.log(`  Chain ID:    ${CHAIN_ID}`);
  console.log(`  Payer:       ${payerAccount.address}`);
  console.log(`  Facilitator: ${facilitatorAccount.address}`);
  console.log(`  Recipient:   ${recipient}`);
  console.log(`  Amount:      ${formatUnits(BigInt(paymentAmount), 6)} USDEMO`);
  console.log();

  // Step 1: Check initial balances
  console.log("Step 1: Check initial balances");
  const payerBalanceBefore = await getBalance(payerAccount.address);
  const recipientBalanceBefore = await getBalance(recipient);
  console.log(`  Payer balance:     ${formatUnits(payerBalanceBefore, 6)} USDEMO`);
  console.log(`  Recipient balance: ${formatUnits(recipientBalanceBefore, 6)} USDEMO`);
  console.log();

  // Step 2: Setup x402 SDK components
  console.log("Step 2: Setup x402 SDK components");

  // Create client signer
  const clientSigner = toClientEvmSigner(payerAccount);
  console.log("  Created client signer");

  // Create facilitator signer
  const facilitatorSigner = toFacilitatorEvmSigner({
    address: facilitatorAccount.address,
    getAddresses: () => [facilitatorAccount.address],
    readContract: async (args) => {
      return publicClient.readContract({
        address: args.address,
        abi: args.abi as readonly unknown[],
        functionName: args.functionName,
        args: args.args as readonly unknown[],
      });
    },
    verifyTypedData: async (args) => {
      return publicClient.verifyTypedData({
        address: args.address,
        domain: args.domain as Record<string, unknown>,
        types: args.types as Record<string, unknown>,
        primaryType: args.primaryType,
        message: args.message,
        signature: args.signature,
      });
    },
    writeContract: async (args) => {
      return facilitatorWalletClient.writeContract({
        address: args.address,
        abi: args.abi as readonly unknown[],
        functionName: args.functionName,
        args: args.args as readonly unknown[],
      });
    },
    sendTransaction: async (args) => {
      return facilitatorWalletClient.sendTransaction(args);
    },
    waitForTransactionReceipt: async (args) => {
      return publicClient.waitForTransactionReceipt(args);
    },
    getCode: async (args) => {
      return publicClient.getCode(args);
    },
  });
  console.log("  Created facilitator signer");

  // Create and configure x402 client
  const client = new x402Client();
  registerExactEvmClientScheme(client, { signer: clientSigner });
  console.log("  Registered exact client scheme (with Permit2 support)");

  // Create and configure x402 facilitator
  const facilitator = new x402Facilitator();
  registerExactEvmFacilitatorScheme(facilitator, {
    signer: facilitatorSigner,
    networks: `eip155:${CHAIN_ID}`,
  });
  console.log("  Registered exact facilitator scheme (with Permit2 support)");
  console.log();

  // Step 3: Create payment requirements
  console.log("Step 3: Create payment requirements");

  const paymentRequirements: PaymentRequirements = {
    scheme: "exact",
    network: `eip155:${CHAIN_ID}`,
    asset: USDEMO_ADDRESS,
    amount: paymentAmount,
    payTo: recipient,
    maxTimeoutSeconds: 300,
    extra: {
      assetTransferMethod: "permit2",
      facilitator: facilitatorAccount.address,
    },
  };

  // Build the PaymentRequired structure (simulating server response)
  const paymentRequired: PaymentRequired = {
    x402Version: 2,
    resource: {
      url: "https://example.com/api/data",
      description: "Test resource",
      mimeType: "application/json",
    },
    accepts: [paymentRequirements],
  };

  console.log("  Payment requirements created:");
  console.log(`    scheme:  ${paymentRequirements.scheme}`);
  console.log(`    network: ${paymentRequirements.network}`);
  console.log(`    asset:   ${paymentRequirements.asset}`);
  console.log(`    amount:  ${paymentRequirements.amount}`);
  console.log(`    payTo:   ${paymentRequirements.payTo}`);
  console.log();

  // Step 4: Client creates payment payload
  console.log("Step 4: Client creates payment payload");

  const paymentPayload = await client.createPaymentPayload(paymentRequired);

  const payload = paymentPayload.payload as Record<string, unknown>;
  console.log("  Payment payload created:");
  console.log(`    x402Version: ${paymentPayload.x402Version}`);
  console.log(`    payload.token: ${payload.token}`);
  console.log(`    payload.amount: ${payload.amount}`);
  console.log(`    payload.owner: ${payload.owner}`);
  console.log(`    payload.signature: ${(payload.signature as string).slice(0, 20)}...`);
  console.log();

  // Step 5: Facilitator verifies payment
  console.log("Step 5: Facilitator verifies payment");

  const verifyResponse = await facilitator.verify(paymentPayload, paymentRequirements);

  console.log("  Verify response:");
  console.log(`    isValid: ${verifyResponse.isValid}`);
  console.log(`    payer: ${verifyResponse.payer}`);
  if (!verifyResponse.isValid) {
    console.log(`    invalidReason: ${verifyResponse.invalidReason}`);
    throw new Error(`Verification failed: ${verifyResponse.invalidReason}`);
  }
  console.log();

  // Step 6: Facilitator settles payment
  console.log("Step 6: Facilitator settles payment");

  const settleResponse = await facilitator.settle(paymentPayload, paymentRequirements);

  console.log("  Settle response:");
  console.log(`    success: ${settleResponse.success}`);
  console.log(`    transaction: ${settleResponse.transaction}`);
  console.log(`    network: ${settleResponse.network}`);
  if (!settleResponse.success) {
    console.log(`    errorReason: ${settleResponse.errorReason}`);
    throw new Error(`Settlement failed: ${settleResponse.errorReason}`);
  }
  console.log();

  // Step 7: Verify final balances
  console.log("Step 7: Verify final balances");
  const payerBalanceAfter = await getBalance(payerAccount.address);
  const recipientBalanceAfter = await getBalance(recipient);

  console.log(`  Payer balance:     ${formatUnits(payerBalanceAfter, 6)} USDEMO`);
  console.log(`  Recipient balance: ${formatUnits(recipientBalanceAfter, 6)} USDEMO`);
  console.log();

  // Verify the transfer happened correctly
  const payerDiff = payerBalanceBefore - payerBalanceAfter;
  const recipientDiff = recipientBalanceAfter - recipientBalanceBefore;

  console.log("Verification:");
  console.log(`  Payer sent:         ${formatUnits(payerDiff, 6)} USDEMO`);
  console.log(`  Recipient received: ${formatUnits(recipientDiff, 6)} USDEMO`);

  if (payerDiff === BigInt(paymentAmount) && recipientDiff === BigInt(paymentAmount)) {
    console.log();
    console.log("=".repeat(60));
    console.log("SUCCESS: x402 Permit2 (via assetTransferMethod) test passed.");
    console.log("=".repeat(60));
    console.log();
    console.log("Validated:");
    console.log("  1. scheme: 'exact' with extra.assetTransferMethod: 'permit2'");
    console.log("  2. Client created valid Permit2 SignatureTransfer payload");
    console.log("  3. Facilitator verified the signature");
    console.log("  4. Facilitator settled via Permit2.permitTransferFrom()");
    console.log("  5. Tokens transferred from payer to recipient");
  } else {
    console.log();
    console.log("FAILED: Amounts don't match expected values");
    process.exit(1);
  }

  console.log();
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
