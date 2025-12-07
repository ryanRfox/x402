/**
 * @fileoverview Permit2 SignatureTransfer test for any supported network.
 *
 * Usage:
 *   npx tsx test-permit2-network.ts [network]
 *
 * Networks: anvil, radius-staging, radius-testnet, base-sepolia
 *
 * For testnets, set PRIVATE_KEY in .env and deploy token first.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  getNetworkConfig,
  getPermit2Domain,
  PERMIT2_ADDRESS,
  PERMIT2_TYPES,
  PERMIT2_ABI,
  ERC20_ABI,
  type NetworkName,
} from "./networks.js";

/**
 * Generates a random nonce for Permit2 SignatureTransfer.
 * Permit2 uses unordered nonces - any unique value works.
 *
 * @returns A random 256-bit nonce
 */
function generateNonce(): bigint {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return BigInt("0x" + Buffer.from(randomBytes).toString("hex"));
}

/**
 * Main test function demonstrating Permit2 SignatureTransfer on any network.
 */
async function main(): Promise<void> {
  const networkName = (process.argv[2] || "anvil") as NetworkName;

  console.log("=".repeat(60));
  console.log(`Permit2 SignatureTransfer Test - ${networkName}`);
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
  const paymentAmount = networkName === "anvil" ? 100_000000n : 1_000000n; // 100 or 1 USDEMO
  const recipient = config.recipient;

  console.log("Configuration:");
  console.log(`  Network:     ${config.chain.name} (${config.networkId})`);
  console.log(`  Token:       ${config.tokenAddress}`);
  console.log(`  Permit2:     ${PERMIT2_ADDRESS}`);
  console.log(`  Payer:       ${payerAccount.address}`);
  console.log(`  Facilitator: ${facilitatorAccount.address}`);
  console.log(`  Recipient:   ${recipient}`);
  console.log(`  Amount:      ${formatUnits(paymentAmount, config.tokenDecimals)} ${config.tokenSymbol}`);
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

  if (payerBalanceBefore < paymentAmount) {
    throw new Error(
      `Insufficient token balance. Have: ${formatUnits(payerBalanceBefore, config.tokenDecimals)}, Need: ${formatUnits(paymentAmount, config.tokenDecimals)}`
    );
  }

  // Check Permit2 allowance
  const allowance = await publicClient.readContract({
    address: config.tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [payerAccount.address, PERMIT2_ADDRESS],
  });
  console.log(`  Permit2 allowance: ${formatUnits(allowance, config.tokenDecimals)} ${config.tokenSymbol}`);

  if (allowance < paymentAmount) {
    throw new Error("Insufficient Permit2 allowance. Approve Permit2 first.");
  }

  // Step 2: Client signs Permit2 SignatureTransfer
  console.log();
  console.log("Step 2: Client signs Permit2 SignatureTransfer");

  const nonce = generateNonce();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

  console.log(`  Nonce:    ${nonce.toString().slice(0, 20)}...`);
  console.log(`  Deadline: ${deadline} (${new Date(Number(deadline) * 1000).toISOString()})`);

  const permitMessage = {
    permitted: {
      token: config.tokenAddress,
      amount: paymentAmount,
    },
    spender: facilitatorAccount.address,
    nonce,
    deadline,
  };

  console.log("  Signing EIP-712 message...");
  const signature = await payerWalletClient.signTypedData({
    domain: getPermit2Domain(config.chain.id),
    types: PERMIT2_TYPES,
    primaryType: "PermitTransferFrom",
    message: permitMessage,
  });

  console.log(`  Signature: ${signature.slice(0, 20)}...${signature.slice(-8)}`);

  // Step 3: Facilitator calls Permit2.permitTransferFrom()
  console.log();
  console.log("Step 3: Facilitator executes permitTransferFrom");

  const permit = {
    permitted: {
      token: config.tokenAddress,
      amount: paymentAmount,
    },
    nonce,
    deadline,
  };

  const transferDetails = {
    to: recipient,
    requestedAmount: paymentAmount,
  };

  console.log("  Calling Permit2.permitTransferFrom()...");
  const txHash = await facilitatorWalletClient.writeContract({
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: "permitTransferFrom",
    args: [permit, transferDetails, payerAccount.address, signature],
  });

  console.log(`  Transaction hash: ${txHash}`);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`  Status: ${receipt.status}`);
  console.log(`  Gas used: ${receipt.gasUsed}`);

  // Step 4: Verify final balances
  console.log();
  console.log("Step 4: Verify final balances");
  const payerBalanceAfter = await getBalance(payerAccount.address);
  const recipientBalanceAfter = await getBalance(recipient);

  console.log(`  Payer balance:     ${formatUnits(payerBalanceAfter, config.tokenDecimals)} ${config.tokenSymbol}`);
  console.log(`  Recipient balance: ${formatUnits(recipientBalanceAfter, config.tokenDecimals)} ${config.tokenSymbol}`);

  // Verify the transfer
  const payerDiff = payerBalanceBefore - payerBalanceAfter;
  const recipientDiff = recipientBalanceAfter - recipientBalanceBefore;

  console.log();
  console.log("Verification:");
  console.log(`  Payer sent:         ${formatUnits(payerDiff, config.tokenDecimals)} ${config.tokenSymbol}`);
  console.log(`  Recipient received: ${formatUnits(recipientDiff, config.tokenDecimals)} ${config.tokenSymbol}`);

  if (payerDiff === paymentAmount && recipientDiff === paymentAmount) {
    console.log();
    console.log("=".repeat(60));
    console.log(`SUCCESS: Permit2 SignatureTransfer on ${networkName}`);
    console.log("=".repeat(60));
    console.log();
    console.log("Key points demonstrated:");
    console.log("  1. Payer signed an EIP-712 message (off-chain, no gas)");
    console.log("  2. Facilitator executed the transfer (on-chain)");
    console.log("  3. Tokens moved from payer to recipient");
    console.log("  4. Only the designated spender (facilitator) could use the signature");
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
