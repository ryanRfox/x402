/**
 * @fileoverview x402 SDK Permit2 Integration Test for any supported network.
 *
 * Usage:
 *   npx tsx test-sdk-network.ts [network]
 *
 * Networks: anvil, radius-staging, radius-testnet, base-sepolia
 *
 * Tests the full x402 SDK flow with assetTransferMethod: "permit2":
 * - Client creates Permit2 SignatureTransfer payloads
 * - Facilitator verifies signatures and settles via Permit2.permitTransferFrom()
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { x402Client } from "@x402/core/client";
import { x402Facilitator } from "@x402/core/facilitator";
import { PaymentRequirements, PaymentRequired } from "@x402/core/types";
import { toClientEvmSigner, toFacilitatorEvmSigner } from "@x402/evm";
import { registerExactEvmScheme as registerExactEvmClientScheme } from "@x402/evm/exact/client";
import { registerExactEvmScheme as registerExactEvmFacilitatorScheme } from "@x402/evm/exact/facilitator";

import {
  getNetworkConfig,
  PERMIT2_ADDRESS,
  ERC20_ABI,
  type NetworkName,
} from "./networks.js";

/**
 * Main test function demonstrating x402 SDK with Permit2 on any network.
 */
async function main(): Promise<void> {
  const networkName = (process.argv[2] || "anvil") as NetworkName;

  console.log("=".repeat(60));
  console.log(`x402 SDK Permit2 Test - ${networkName}`);
  console.log("=".repeat(60));
  console.log();

  const config = getNetworkConfig(networkName);

  if (!config.tokenAddress) {
    throw new Error(
      `Token address not set for ${networkName}. Deploy first: npx tsx deploy-token.ts ${networkName}`
    );
  }

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  // Payer (client) - signs the Permit2 message
  const payerAccount = privateKeyToAccount(config.payer.privateKey);
  const payerWalletClient = createWalletClient({
    account: payerAccount,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  // Facilitator - executes the transfer
  const facilitatorAccount = privateKeyToAccount(config.facilitator.privateKey);
  const facilitatorWalletClient = createWalletClient({
    account: facilitatorAccount,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  // Payment details - use smaller amount for testnets
  const paymentAmount = networkName === "anvil" ? "100000000" : "1000000"; // 100 or 1 USDEMO
  const recipient = config.recipient;

  console.log("Configuration:");
  console.log(`  Network:     ${config.chain.name} (${config.networkId})`);
  console.log(`  Token:       ${config.tokenAddress}`);
  console.log(`  Permit2:     ${PERMIT2_ADDRESS}`);
  console.log(`  Payer:       ${payerAccount.address}`);
  console.log(`  Facilitator: ${facilitatorAccount.address}`);
  console.log(`  Recipient:   ${recipient}`);
  console.log(`  Amount:      ${formatUnits(BigInt(paymentAmount), config.tokenDecimals)} ${config.tokenSymbol}`);
  console.log();

  // Check ETH balance for gas
  const ethBalance = await publicClient.getBalance({ address: payerAccount.address });
  console.log(`Payer ETH balance: ${formatEther(ethBalance)} ETH`);

  /**
   * Gets the token balance for an address.
   */
  async function getBalance(address: `0x${string}`): Promise<bigint> {
    return publicClient.readContract({
      address: config.tokenAddress!,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });
  }

  // Step 1: Check initial balances
  console.log();
  console.log("Step 1: Check initial balances");
  const payerBalanceBefore = await getBalance(payerAccount.address);
  const recipientBalanceBefore = await getBalance(recipient);
  console.log(`  Payer balance:     ${formatUnits(payerBalanceBefore, config.tokenDecimals)} ${config.tokenSymbol}`);
  console.log(`  Recipient balance: ${formatUnits(recipientBalanceBefore, config.tokenDecimals)} ${config.tokenSymbol}`);

  if (payerBalanceBefore < BigInt(paymentAmount)) {
    throw new Error(
      `Insufficient token balance. Have: ${formatUnits(payerBalanceBefore, config.tokenDecimals)}, Need: ${formatUnits(BigInt(paymentAmount), config.tokenDecimals)}`
    );
  }

  // Step 2: Setup x402 SDK components
  console.log();
  console.log("Step 2: Setup x402 SDK components");

  // Create client signer
  const clientSigner = toClientEvmSigner(payerAccount);
  console.log("  Created client signer");

  // Create facilitator signer
  const facilitatorSigner = toFacilitatorEvmSigner({
    address: facilitatorAccount.address,
    readContract: async (args) => {
      return publicClient.readContract({
        address: args.address,
        abi: args.abi,
        functionName: args.functionName,
        args: args.args,
      });
    },
    verifyTypedData: async (args) => {
      return publicClient.verifyTypedData({
        address: args.address,
        domain: args.domain,
        types: args.types,
        primaryType: args.primaryType,
        message: args.message,
        signature: args.signature,
      } as Parameters<typeof publicClient.verifyTypedData>[0]);
    },
    writeContract: async (args) => {
      return facilitatorWalletClient.writeContract({
        address: args.address,
        abi: args.abi,
        functionName: args.functionName,
        args: args.args,
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
    networks: config.networkId as `${string}:${string}`,
  });
  console.log("  Registered exact facilitator scheme (with Permit2 support)");

  // Step 3: Create payment requirements
  console.log();
  console.log("Step 3: Create payment requirements");

  const paymentRequirements: PaymentRequirements = {
    scheme: "exact",
    network: config.networkId as `${string}:${string}`,
    asset: config.tokenAddress,
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
      url: `https://example.com/api/data`,
      description: `Test resource on ${networkName}`,
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

  // Step 4: Client creates payment payload
  console.log();
  console.log("Step 4: Client creates payment payload");

  const paymentPayload = await client.createPaymentPayload(paymentRequired);

  const payload = paymentPayload.payload as Record<string, unknown>;
  console.log("  Payment payload created:");
  console.log(`    x402Version: ${paymentPayload.x402Version}`);
  console.log(`    payload.token: ${payload.token}`);
  console.log(`    payload.amount: ${payload.amount}`);
  console.log(`    payload.owner: ${payload.owner}`);
  console.log(`    payload.signature: ${(payload.signature as string).slice(0, 20)}...`);

  // Step 5: Facilitator verifies payment
  console.log();
  console.log("Step 5: Facilitator verifies payment");

  const verifyResponse = await facilitator.verify(paymentPayload, paymentRequirements);

  console.log("  Verify response:");
  console.log(`    isValid: ${verifyResponse.isValid}`);
  console.log(`    payer: ${verifyResponse.payer}`);
  if (!verifyResponse.isValid) {
    console.log(`    invalidReason: ${verifyResponse.invalidReason}`);
    throw new Error(`Verification failed: ${verifyResponse.invalidReason}`);
  }

  // Step 6: Facilitator settles payment
  console.log();
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

  // Step 7: Verify final balances
  console.log();
  console.log("Step 7: Verify final balances");
  const payerBalanceAfter = await getBalance(payerAccount.address);
  const recipientBalanceAfter = await getBalance(recipient);

  console.log(`  Payer balance:     ${formatUnits(payerBalanceAfter, config.tokenDecimals)} ${config.tokenSymbol}`);
  console.log(`  Recipient balance: ${formatUnits(recipientBalanceAfter, config.tokenDecimals)} ${config.tokenSymbol}`);

  // Verify the transfer happened correctly
  const payerDiff = payerBalanceBefore - payerBalanceAfter;
  const recipientDiff = recipientBalanceAfter - recipientBalanceBefore;

  console.log();
  console.log("Verification:");
  console.log(`  Payer sent:         ${formatUnits(payerDiff, config.tokenDecimals)} ${config.tokenSymbol}`);
  console.log(`  Recipient received: ${formatUnits(recipientDiff, config.tokenDecimals)} ${config.tokenSymbol}`);

  if (payerDiff === BigInt(paymentAmount) && recipientDiff === BigInt(paymentAmount)) {
    console.log();
    console.log("=".repeat(60));
    console.log(`SUCCESS: x402 SDK Permit2 test passed on ${networkName}`);
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
