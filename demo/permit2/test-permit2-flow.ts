/**
 * @fileoverview Permit2 SignatureTransfer Demo
 *
 * Demonstrates the full Permit2 flow:
 * 1. Client (payer) signs a Permit2 SignatureTransfer message
 * 2. Facilitator calls Permit2.permitTransferFrom() with the signature
 * 3. Tokens are transferred from payer to recipient
 *
 * Prerequisites:
 * - Anvil running: anvil
 * - Permit2 deployed (see README.md)
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

import {
  PERMIT2_ADDRESS,
  USDEMO_ADDRESS,
  ANVIL_ACCOUNT_0,
  ANVIL_ACCOUNT_1,
  CHAIN_ID,
  PERMIT2_DOMAIN,
  PERMIT2_TYPES,
  PERMIT2_ABI,
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
 * Main demo function demonstrating Permit2 SignatureTransfer flow.
 */
async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Permit2 SignatureTransfer Demo");
  console.log("=".repeat(60));
  console.log();

  // Payment details
  const paymentAmount = 100_000000n; // 100 USDEMO (6 decimals)
  const recipient = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as `0x${string}`; // Anvil account 2

  console.log("Configuration:");
  console.log(`  Token:       ${USDEMO_ADDRESS}`);
  console.log(`  Permit2:     ${PERMIT2_ADDRESS}`);
  console.log(`  Chain ID:    ${CHAIN_ID}`);
  console.log(`  Payer:       ${payerAccount.address}`);
  console.log(`  Facilitator: ${facilitatorAccount.address}`);
  console.log(`  Recipient:   ${recipient}`);
  console.log(`  Amount:      ${formatUnits(paymentAmount, 6)} USDEMO`);
  console.log();

  // Step 1: Check initial balances
  console.log("Step 1: Check initial balances");
  const payerBalanceBefore = await getBalance(payerAccount.address);
  const recipientBalanceBefore = await getBalance(recipient);
  console.log(`  Payer balance:     ${formatUnits(payerBalanceBefore, 6)} USDEMO`);
  console.log(`  Recipient balance: ${formatUnits(recipientBalanceBefore, 6)} USDEMO`);
  console.log();

  // Step 2: Client signs Permit2 SignatureTransfer
  console.log("Step 2: Client signs Permit2 SignatureTransfer");

  const nonce = generateNonce();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

  console.log(`  Nonce:    ${nonce}`);
  console.log(`  Deadline: ${deadline} (${new Date(Number(deadline) * 1000).toISOString()})`);

  // Build the EIP-712 message
  // IMPORTANT: The "spender" in the signed message is the facilitator
  // who will call permitTransferFrom. This prevents anyone else from
  // using the signature.
  const permitMessage = {
    permitted: {
      token: USDEMO_ADDRESS,
      amount: paymentAmount,
    },
    spender: facilitatorAccount.address, // Only facilitator can use this signature
    nonce,
    deadline,
  };

  console.log("  Signing EIP-712 message...");
  const signature = await payerWalletClient.signTypedData({
    domain: PERMIT2_DOMAIN,
    types: PERMIT2_TYPES,
    primaryType: "PermitTransferFrom",
    message: permitMessage,
  });

  console.log(`  Signature: ${signature.slice(0, 20)}...${signature.slice(-8)}`);
  console.log();

  // Step 3: Facilitator calls Permit2.permitTransferFrom()
  console.log("Step 3: Facilitator executes permitTransferFrom");

  // The permit struct passed to the contract (without spender - it's msg.sender)
  const permit = {
    permitted: {
      token: USDEMO_ADDRESS,
      amount: paymentAmount,
    },
    nonce,
    deadline,
  };

  // Transfer details - where the tokens actually go
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
  console.log();

  // Step 4: Verify final balances
  console.log("Step 4: Verify final balances");
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

  if (payerDiff === paymentAmount && recipientDiff === paymentAmount) {
    console.log();
    console.log("SUCCESS: Permit2 SignatureTransfer worked correctly.");
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
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
