import { config } from "dotenv";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
config();

const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;
const svmAddress = process.env.SVM_ADDRESS;
if (!evmAddress || !svmAddress) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const facilitatorUrl = process.env.FACILITATOR_URL;
if (!facilitatorUrl) {
  console.error("❌ FACILITATOR_URL environment variable is required");
  process.exit(1);
}
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

// CAIP-2 EVM network selection for the route. Default is Base Sepolia (eip155:84532);
// set EVM_NETWORK to point at any EVM chain in @x402/evm's DEFAULT_STABLECOINS.
// NOTE: the eip155:100 (Gnosis Chain) literal below is intentional — it teaches
// the registerMoneyParser pattern for a custom-chain asset, independent of the
// route's chain selection.
const EVM_NETWORK = (process.env.EVM_NETWORK ?? "eip155:84532") as `${string}:${string}`;

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: {
          scheme: "exact",
          price: "$0.001",
          network: EVM_NETWORK,
          payTo: evmAddress,
        },
        description: "Weather data",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(facilitatorClient).register(
      EVM_NETWORK,
      new ExactEvmScheme().registerMoneyParser(async (amount, network) => {
        // Custom money parser such that on the Gnosis Chain (xDai) network, we use Wrapped XDAI (WXDAI) when describing money
        // NOTE: Wrapped XDAI is not an EIP-3009 complaint token, and would fail the current ExactEvm implementation. This example is for demonstration purposes
        if (network == "eip155:100") {
          return {
            amount: BigInt(Math.round(amount * 1e18)).toString(),
            asset: "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d",
            extra: { token: "Wrapped XDAI" },
          };
        }
        return null;
      }),
    ),
  ),
);

app.get("/weather", (req, res) => {
  res.send({
    report: {
      weather: "sunny",
      temperature: 70,
    },
  });
});

app.listen(4021, () => {
  console.log(`Server listening at http://localhost:${4021}`);
});
