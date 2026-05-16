import { config } from "dotenv";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
config();

const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;
if (!evmAddress) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const facilitatorUrl = process.env.FACILITATOR_URL;
if (!facilitatorUrl) {
  console.error("❌ FACILITATOR_URL environment variable is required");
  process.exit(1);
}
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

// CAIP-2 EVM network selection. Default is Base Sepolia (eip155:84532); set
// EVM_NETWORK to point at any EVM chain in @x402/evm's DEFAULT_STABLECOINS.
const EVM_NETWORK = (process.env.EVM_NETWORK ?? "eip155:84532") as `${string}:${string}`;

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: {
          scheme: "exact",
          price: context => {
            // Dynamic pricing based on HTTP request context
            const tier = context.adapter.getQueryParam?.("tier") ?? "standard";
            return tier === "premium" ? "$0.005" : "$0.001";
          },
          network: EVM_NETWORK,
          payTo: evmAddress,
        },
        description: "Weather data",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(facilitatorClient).register(EVM_NETWORK, new ExactEvmScheme()),
  ),
);

app.get("/weather", (req, res) => {
  const tier = req.query.tier ?? "standard";

  if (tier === "premium") {
    // Premium tier gets detailed weather data
    res.send({
      report: {
        weather: "sunny",
        temperature: 70,
        humidity: 45,
        windSpeed: 12,
        precipitation: 0,
      },
    });
  } else {
    // Standard tier gets basic weather data
    res.send({
      report: {
        weather: "sunny",
        temperature: 70,
      },
    });
  }
});

app.listen(4021, () => {
  console.log(`Server listening at http://localhost:${4021}`);
});
