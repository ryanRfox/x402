import { config } from "dotenv";
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { base58 } from "@scure/base";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { x402Client, x402HTTPClient, PaymentPolicy } from "@x402/core/client";

config();

const baseURL = process.env.RESOURCE_SERVER_URL as string;
const endpointPath = process.env.ENDPOINT_PATH as string;
const url = `${baseURL}${endpointPath}`;
const evmAccount = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const svmSigner = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SVM_PRIVATE_KEY as string),
);

// Create client and register EVM and SVM schemes using the new register helpers
const client = new x402Client();
registerExactEvmScheme(client, { signer: evmAccount });
registerExactSvmScheme(client, { signer: svmSigner });

// Optional: prefer specific assets when multiple options are available
// Usage: CLIENT_PREFER_ASSET=USDC,WETH (comma-separated symbols, preference order)
const preferredAssets = (process.env.CLIENT_PREFER_ASSET || "")
  .split(",")
  .map(s => s.trim().toUpperCase())
  .filter(Boolean);

if (preferredAssets.length > 0) {
  // Testnet asset addresses by symbol (all known addresses across networks)
  const assetAddresses: Record<string, string[]> = {
    USDC: [
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    ],
    WETH: ["0x4200000000000000000000000000000000000006"],
  };

  const preferAssetPolicy: PaymentPolicy = (_version, requirements) => {
    const scored = requirements.map(req => {
      const assetLower = req.asset.toLowerCase();
      for (let i = 0; i < preferredAssets.length; i++) {
        const addresses = assetAddresses[preferredAssets[i]] || [];
        if (addresses.some(a => a.toLowerCase() === assetLower)) {
          return { req, score: i };
        }
      }
      return { req, score: preferredAssets.length };
    });
    return scored.sort((a, b) => a.score - b.score).map(s => s.req);
  };
  client.registerPolicy(preferAssetPolicy);
}

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

fetchWithPayment(url, {
  method: "GET",
}).then(async response => {
  const data = await response.json();
  const paymentResponse = new x402HTTPClient(client).getPaymentSettleResponse(name =>
    response.headers.get(name),
  );

  if (!paymentResponse) {
    // No payment was required
    const result = {
      success: true,
      data: data,
      status_code: response.status,
    };
    console.log(JSON.stringify(result));
    process.exit(0);
    return;
  }

  const result = {
    success: paymentResponse.success,
    data: data,
    status_code: response.status,
    payment_response: paymentResponse,
  };

  // Output structured result as JSON for proxy to parse
  console.log(JSON.stringify(result));
  process.exit(0);
});
