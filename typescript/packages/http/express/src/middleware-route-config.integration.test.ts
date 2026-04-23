import { describe, it, expect } from "vitest";
import type { Request, Response } from "express";
import { x402ResourceServer } from "@x402/core/server";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import type {
  FacilitatorClient,
  PaymentRequirements,
  SchemeNetworkServer,
  SupportedResponse,
  VerifyResponse,
  SettleResponse,
} from "@x402/core/types";
import { paymentMiddleware } from "./index";

const TEST_NETWORK = "eip155:84532";
const TEST_SCHEME = "exact";
const TEST_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const passthroughFacilitator: FacilitatorClient = {
  verify: async () => ({ isValid: true }) as VerifyResponse,
  settle: async () => ({ success: true }) as SettleResponse,
  getSupported: async (): Promise<SupportedResponse> => ({
    kinds: [{ x402Version: 2, scheme: TEST_SCHEME, network: TEST_NETWORK }],
    extensions: [],
    signers: { "eip155:*": ["0x0000000000000000000000000000000000000000"] },
  }),
};

const echoScheme: SchemeNetworkServer = {
  scheme: TEST_SCHEME,
  parsePrice: async () => ({
    amount: "1000",
    asset: TEST_ASSET,
    extra: {},
  }),
  enhancePaymentRequirements: async (
    paymentRequirements: PaymentRequirements,
  ): Promise<PaymentRequirements> => paymentRequirements,
};

/**
 * Builds a minimal Express Request for the middleware under test.
 *
 * @param path - Request URL path.
 * @param method - HTTP method.
 * @returns An Express-compatible Request object with just enough shape for the adapter.
 */
function createRequest(path = "/paid", method = "GET"): Request {
  return {
    path,
    method,
    url: path,
    protocol: "http",
    hostname: "localhost",
    originalUrl: path,
    header: () => undefined,
    headers: {},
    get: (name: string) => (name.toLowerCase() === "host" ? "localhost:3000" : undefined),
  } as unknown as Request;
}

/**
 * Builds a minimal Express Response with an `_inspect()` hook for test assertions.
 *
 * @returns Response-like object that records status, headers, and body in memory.
 */
function createResponse() {
  const headers: Record<string, string> = {};
  let status = 200;
  let body: unknown = undefined;
  let ended = false;
  const res = {
    statusCode: 200,
    status(code: number) {
      status = code;
      res.statusCode = code;
      return res;
    },
    setHeader(key: string, value: string) {
      headers[key] = value;
      return res;
    },
    getHeader(key: string) {
      return headers[key];
    },
    getHeaders() {
      return headers;
    },
    removeHeader(key: string) {
      delete headers[key];
      return res;
    },
    json(payload: unknown) {
      body = payload;
      ended = true;
      return res;
    },
    send(payload: unknown) {
      body = payload;
      ended = true;
      return res;
    },
    writeHead(code: number) {
      status = code;
      res.statusCode = code;
      return res;
    },
    write() {
      return true;
    },
    end() {
      ended = true;
      return res;
    },
    flushHeaders() {},
    _inspect: () => ({ status, headers, body, ended }),
  };
  return res as unknown as Response & {
    _inspect: () => {
      status: number;
      headers: Record<string, string>;
      body: unknown;
      ended: boolean;
    };
  };
}

describe("paymentMiddleware route-config pass-through (hq-dffn1)", () => {
  it("honors user-supplied payTo and description in the 402 PAYMENT-REQUIRED header", async () => {
    const userPayTo = "0x000000000000000000000000000000000000DEAD";
    const userDescription = "A paid endpoint — exact user string";

    const server = new x402ResourceServer(passthroughFacilitator).register("eip155:*", echoScheme);

    const middleware = paymentMiddleware(
      {
        "GET /paid": {
          accepts: [
            {
              scheme: TEST_SCHEME,
              network: TEST_NETWORK,
              payTo: userPayTo,
              price: "$0.001",
            },
          ],
          description: userDescription,
          mimeType: "application/json",
        },
      },
      server,
      undefined,
      undefined,
      true,
    );

    const req = createRequest("/paid", "GET");
    const res = createResponse();

    let nextCalled = false;
    await middleware(req, res, () => {
      nextCalled = true;
    });

    const snap = res._inspect();
    expect(nextCalled).toBe(false);
    expect(snap.status).toBe(402);

    const headerValue = snap.headers["PAYMENT-REQUIRED"];
    expect(typeof headerValue).toBe("string");
    expect(headerValue).toBeTruthy();

    const decoded = decodePaymentRequiredHeader(headerValue as string);
    expect(decoded.resource?.description).toBe(userDescription);
    expect(decoded.accepts).toHaveLength(1);
    expect(decoded.accepts[0].payTo).toBe(userPayTo);
    expect(decoded.accepts[0].network).toBe(TEST_NETWORK);
    expect(decoded.accepts[0].scheme).toBe(TEST_SCHEME);
  });

  it("honors a different user config the next call (no cross-request leakage of hardcoded defaults)", async () => {
    const userPayTo = "0x0000000000000000000000000000000000BEEF00";
    const userDescription = "Second request distinct copy";

    const server = new x402ResourceServer(passthroughFacilitator).register("eip155:*", echoScheme);

    const middleware = paymentMiddleware(
      {
        "GET /other": {
          accepts: [
            {
              scheme: TEST_SCHEME,
              network: TEST_NETWORK,
              payTo: userPayTo,
              price: "$0.01",
            },
          ],
          description: userDescription,
          mimeType: "application/json",
        },
      },
      server,
      undefined,
      undefined,
      true,
    );

    const req = createRequest("/other", "GET");
    const res = createResponse();

    await middleware(req, res, () => {});
    const snap = res._inspect();

    const decoded = decodePaymentRequiredHeader(snap.headers["PAYMENT-REQUIRED"] as string);
    expect(decoded.resource?.description).toBe(userDescription);
    expect(decoded.accepts[0].payTo).toBe(userPayTo);
  });
});
