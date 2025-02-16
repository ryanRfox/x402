import { Address } from "viem";
import { expect, test, describe } from "vitest";
import { createPayment } from "./client";
import { verifyPayment } from "./facilitator";
import { baseSepolia } from "viem/chains";
import { Resource } from "./types";
import { getUsdcAddressForChain } from "./usdc";
import { botWallet } from "./wallet";
describe("sign and recover", () => {
  // const wallet = createWalletClient({
  //   chain: baseSepolia,
  //   account: privateKeyToAccount(
  //     "0x1234567890123456789012345678901234567890123456789012345678901234"
  //   ),
  //   transport: http(),
  // }).extend(publicActions);

  const wallet = botWallet;

  test("happy path sign and recover", async () => {
    console.log(`wallet: ${wallet.account?.address}`);

    const paymentDetails = {
      version: 1,
      maxAmountRequired: BigInt(1 * 10 ** 6),
      resource: "https://example.com" as Resource,
      description: "example",
      mimeType: "text/plain",
      routerAddress: "0x0000000000000000000000000000000000000000" as Address,
      resourceMaxTimeSeconds: 10,
      recommendedDeadlineSeconds: 60,
      chainId: baseSepolia.id,
      usdcAddress: getUsdcAddressForChain(wallet.chain?.id as number),
    };

    const payment = await createPayment(wallet, paymentDetails);

    console.log(payment);

    const valid = await verifyPayment(wallet, payment, paymentDetails);
    console.log(valid);
    expect(valid.isValid).toBe(true);
  });

  test("rejects incompatible payload version", async () => {
    const paymentDetails = {
      version: 2, // Different version
      maxAmountRequired: BigInt(1 * 10 ** 6),
      resource: "https://example.com" as Resource,
      description: "example",
      mimeType: "text/plain",
      routerAddress: "0x0000000000000000000000000000000000000000" as Address,
      resourceMaxTimeSeconds: 10,
      recommendedDeadlineSeconds: 60,
      chainId: baseSepolia.id,
      usdcAddress: getUsdcAddressForChain(wallet.chain?.id as number),
    };

    const payment = await createPayment(
      wallet,
      { ...paymentDetails, version: 1 } // Create payment with v1 but verify against v2
    );

    const valid = await verifyPayment(wallet, payment, paymentDetails);
    expect(valid.isValid).toBe(false);
    expect(valid.invalidReason).toContain("Incompatible payload version");
  });

  test("rejects invalid USDC address", async () => {
    const paymentDetails = {
      version: 1,
      maxAmountRequired: BigInt(1 * 10 ** 6),
      resource: "https://example.com" as Resource,
      description: "example",
      mimeType: "text/plain",
      routerAddress: "0x0000000000000000000000000000000000000000" as Address,
      resourceMaxTimeSeconds: 10,
      recommendedDeadlineSeconds: 60,
      chainId: baseSepolia.id,
      usdcAddress: "0x1234567890123456789012345678901234567890" as Address, // Wrong address
    };

    const payment = await createPayment(wallet, paymentDetails);

    const valid = await verifyPayment(wallet, payment, paymentDetails);
    expect(valid.isValid).toBe(false);
    expect(valid.invalidReason).toBe("Invalid usdc address");
  });

  test("rejects invalid permit signature", async () => {
    const paymentDetails = {
      version: 1,
      maxAmountRequired: BigInt(1 * 10 ** 6),
      resource: "https://example.com" as Resource,
      description: "example",
      mimeType: "text/plain",
      routerAddress: "0x0000000000000000000000000000000000000000" as Address,
      resourceMaxTimeSeconds: 10,
      recommendedDeadlineSeconds: 60,
      chainId: baseSepolia.id,
      usdcAddress: getUsdcAddressForChain(wallet.chain?.id as number),
    };

    const payment = await createPayment(wallet, paymentDetails);

    // Corrupt the signature
    const corruptedPayment = {
      ...payment,
      payload: {
        ...payment.payload,
        signature: "0x1234" as `0x${string}`,
      },
    };

    const valid = await verifyPayment(wallet, corruptedPayment, paymentDetails);
    expect(valid.isValid).toBe(false);
    expect(valid.invalidReason).toBe("Invalid permit signature");
  });

  test("rejects expired deadline", async () => {
    const paymentDetails = {
      version: 1,
      maxAmountRequired: BigInt(1 * 10 ** 6),
      resource: "https://example.com" as Resource,
      description: "example",
      mimeType: "text/plain",
      routerAddress: "0x0000000000000000000000000000000000000000" as Address,
      resourceMaxTimeSeconds: 10,
      recommendedDeadlineSeconds: 1,
      chainId: baseSepolia.id,
      usdcAddress: getUsdcAddressForChain(wallet.chain?.id as number),
    };

    const payment = await createPayment(wallet, paymentDetails);

    const valid = await verifyPayment(wallet, payment, paymentDetails);
    expect(valid.isValid).toBe(false);
    expect(valid.invalidReason).toBe(
      "Deadline on permit isn't far enough in the future"
    );
  });

  test("rejects insufficient funds", async () => {
    const paymentDetails = {
      version: 1,
      maxAmountRequired: BigInt(999999999 * 10 ** 6), // Very large amount
      resource: "https://example.com" as Resource,
      description: "example",
      mimeType: "text/plain",
      routerAddress: "0x0000000000000000000000000000000000000000" as Address,
      resourceMaxTimeSeconds: 10,
      recommendedDeadlineSeconds: 60,
      chainId: baseSepolia.id,
      usdcAddress: getUsdcAddressForChain(wallet.chain?.id as number),
    };

    const payment = await createPayment(wallet, paymentDetails);

    const valid = await verifyPayment(wallet, payment, paymentDetails);
    expect(valid.isValid).toBe(false);
    expect(valid.invalidReason).toBe("Client does not have enough funds");
  });

  test("rejects insufficient value in payload", async () => {
    const paymentDetails = {
      version: 1,
      maxAmountRequired: BigInt(2 * 10 ** 6),
      resource: "https://example.com" as Resource,
      description: "example",
      mimeType: "text/plain",
      routerAddress: "0x0000000000000000000000000000000000000000" as Address,
      resourceMaxTimeSeconds: 10,
      recommendedDeadlineSeconds: 60,
      chainId: baseSepolia.id,
      usdcAddress: getUsdcAddressForChain(wallet.chain?.id as number),
    };

    const payment = await createPayment(
      wallet,
      { ...paymentDetails, maxAmountRequired: BigInt(1 * 10 ** 6) } // Create with lower amount
    );

    const valid = await verifyPayment(wallet, payment, paymentDetails);
    expect(valid.isValid).toBe(false);
    expect(valid.invalidReason).toBe(
      "Value in payload is not enough to cover paymentDetails.maxAmountRequired"
    );
  });
});
