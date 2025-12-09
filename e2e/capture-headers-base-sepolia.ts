#!/usr/bin/env npx tsx
/**
 * Capture PAYMENT headers from Base Sepolia E2E test
 *
 * This script captures the PAYMENT-REQUIRED, PAYMENT-SIGNATURE, and PAYMENT-RECEIPT headers
 * from a live test against the /protected-permit2 endpoint on Base Sepolia.
 *
 * Prerequisites:
 * 1. Settlement contract deployed to Base Sepolia
 * 2. Client account has WETH and Permit2 approval
 * 3. Facilitator and Server running (or run this script after manual start)
 */

import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const CLIENT_PRIVATE_KEY = process.env.CLIENT_EVM_PRIVATE_KEY || "0x148d11da374c17c691e9786edb9d003178fa9ae0438b30649de9b5f86f963634";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:4021";

async function main() {
  console.log("=== Base Sepolia Header Capture ===\n");
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`Settlement Contract: 0xbC15B94Cb88Ef8462Daa9eb3652478887a9eA976`);

  // Step 1: Capture PAYMENT-REQUIRED header
  console.log("\n--- Step 1: Capture PAYMENT-REQUIRED ---");
  const paymentRequiredResponse = await fetch(`${SERVER_URL}/protected-permit2`, {
    method: "GET",
  });

  if (paymentRequiredResponse.status !== 402) {
    throw new Error(`Expected 402, got ${paymentRequiredResponse.status}`);
  }

  const paymentRequiredHeader = paymentRequiredResponse.headers.get("PAYMENT-REQUIRED") ||
    paymentRequiredResponse.headers.get("X-PAYMENT-REQUIRED");
  if (!paymentRequiredHeader) {
    throw new Error("No PAYMENT-REQUIRED header found");
  }

  console.log("\nPAYMENT-REQUIRED (base64):");
  console.log(paymentRequiredHeader.substring(0, 100) + "...");

  const paymentRequiredDecoded = JSON.parse(Buffer.from(paymentRequiredHeader, "base64").toString());
  console.log("\nDecoded PAYMENT-REQUIRED:");
  console.log(JSON.stringify(paymentRequiredDecoded, null, 2));

  // Step 2: Create client and make payment request
  console.log("\n--- Step 2: Create Payment and Submit ---");

  const account = privateKeyToAccount(CLIENT_PRIVATE_KEY as `0x${string}`);
  console.log(`Client address: ${account.address}`);

  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  // Make payment request - this will capture all headers
  console.log("\nMaking payment request...");

  const paymentResponse = await fetchWithPayment(`${SERVER_URL}/protected-permit2`, {
    method: "GET",
  });

  console.log(`Response status: ${paymentResponse.status}`);

  // Capture the payment receipt
  const paymentReceiptHeader = paymentResponse.headers.get("PAYMENT-RECEIPT") ||
    paymentResponse.headers.get("X-PAYMENT-RECEIPT") ||
    paymentResponse.headers.get("PAYMENT-RESPONSE") ||
    paymentResponse.headers.get("X-PAYMENT-RESPONSE");

  if (paymentReceiptHeader) {
    console.log("\n--- PAYMENT-RECEIPT ---");
    console.log("Base64:");
    console.log(paymentReceiptHeader);

    const paymentReceiptDecoded = JSON.parse(Buffer.from(paymentReceiptHeader, "base64").toString());
    console.log("\nDecoded:");
    console.log(JSON.stringify(paymentReceiptDecoded, null, 2));

    if (paymentReceiptDecoded.transaction) {
      console.log(`\n✅ Transaction hash: ${paymentReceiptDecoded.transaction}`);
      console.log(`View on Basescan: https://sepolia.basescan.org/tx/${paymentReceiptDecoded.transaction}`);
    }
  } else {
    console.log("\n⚠️  No PAYMENT-RECEIPT header found");
  }

  const responseBody = await paymentResponse.json();
  console.log("\nResponse body:");
  console.log(JSON.stringify(responseBody, null, 2));

  // Output final structured data
  console.log("\n========================================");
  console.log("=== DOCUMENTATION OUTPUT ===");
  console.log("========================================");

  console.log("\n### PAYMENT-REQUIRED (Base Sepolia) ###");
  console.log("```");
  console.log(paymentRequiredHeader);
  console.log("```");

  if (paymentReceiptHeader) {
    const paymentReceiptDecoded = JSON.parse(Buffer.from(paymentReceiptHeader, "base64").toString());
    console.log("\n### PAYMENT-RECEIPT (Base Sepolia) ###");
    console.log("```");
    console.log(paymentReceiptHeader);
    console.log("```");
    console.log("\nDecoded JSON:");
    console.log("```json");
    console.log(JSON.stringify(paymentReceiptDecoded, null, 2));
    console.log("```");
  }
}

main().catch(console.error);
