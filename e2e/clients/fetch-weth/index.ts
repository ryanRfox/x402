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

// Base Sepolia WETH address
const WETH_ASSET = "0x4200000000000000000000000000000000000006";

// Policy: prefer WETH payment options when available, fall back to all options otherwise.
const preferWeth: PaymentPolicy = (_version, requirements) => {
  const wethOptions = requirements.filter(r => r.asset.toLowerCase() === WETH_ASSET.toLowerCase());
  return wethOptions.length > 0 ? wethOptions : requirements;
};

// Create client and register EVM and SVM schemes, passing the WETH preference policy
const client = new x402Client();
registerExactEvmScheme(client, { signer: evmAccount, policies: [preferWeth] });
registerExactSvmScheme(client, { signer: svmSigner });

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
