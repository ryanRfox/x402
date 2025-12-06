# Claude Code Guidelines - Arbitrary Token Support (Permit2)

This file provides context for implementing Permit2 support in x402. Read this alongside `PROMPT.arbitrary-token-support.md`.

## Quick Context

You are extending x402 to support ANY ERC-20 token using Uniswap's Permit2. This is the same approach Circle chose for CPN (Circle Payments Network) over EIP-3009.

**Key insight:** Use **SignatureTransfer** (not AllowanceTransfer) for payment settlement - it's more secure for one-time payment signatures.

## Local Development (V2 SDK)

**CRITICAL**: Never install x402 packages from npm - they are V1.

See `docs/LOCAL-DEVELOPMENT.md` for full details. Quick reference:

| Location | Protocol | Example |
|----------|----------|---------|
| Inside monorepo | `workspace:*` | `"@x402/core": "workspace:*"` |
| Outside monorepo | `file:` | `"@x402/core": "file:../typescript/packages/core"` |
| npm | **NEVER** | Do not use npm for x402 packages |

## Source of Truth

**CRITICAL**: The authoritative branch is `upstream/development-v2`. Always verify patterns against actual source code.

### Key Files for This Effort

```
# STUDY THESE FIRST - Existing EVM implementation
typescript/packages/mechanisms/evm/src/exact/client.ts
typescript/packages/mechanisms/evm/src/exact/server.ts
typescript/packages/mechanisms/evm/src/exact/facilitator.ts
typescript/packages/mechanisms/evm/src/exact/types.ts
typescript/packages/mechanisms/evm/README.md

# Core abstractions
typescript/packages/core/src/client/x402Client.ts
typescript/packages/core/src/server/x402ResourceServer.ts
typescript/packages/core/src/facilitator/x402Facilitator.ts
typescript/packages/core/src/types/

# E2E patterns (how schemes are wired up)
e2e/clients/fetch/index.ts
e2e/servers/express/index.ts
e2e/facilitators/typescript/index.ts
```

## V2 API Patterns

**CRITICAL**: Use V2 registration patterns. Never use V1 class instantiation.

### Correct V2 Pattern

```typescript
// Client
import { x402Client } from "@x402/core/client";
import { registerPermit2EvmScheme } from "@x402/evm/permit2/client";

const client = new x402Client();
registerPermit2EvmScheme(client, { signer });

// Server
import { x402ResourceServer } from "@x402/core/server";
import { registerPermit2EvmScheme } from "@x402/evm/permit2/server";

const server = new x402ResourceServer(facilitatorClient);
registerPermit2EvmScheme(server);

// Facilitator
import { x402Facilitator } from "@x402/core/facilitator";
import { registerPermit2EvmScheme } from "@x402/evm/permit2/facilitator";

const facilitator = new x402Facilitator();
registerPermit2EvmScheme(facilitator, { signer, networks: "eip155:*" });
```

### Wrong V1 Pattern (NEVER USE)

```typescript
// WRONG - V1 pattern
const client = new Permit2EvmClient(signer);
client.register("eip155:*", new Permit2Scheme());
```

## Permit2 Technical Details

### Contract Address (Universal)

```
0x000000000022D473030F116dDEE9F6B43aC78BA3
```

Same address on ALL EVM chains (Ethereum, Base, Optimism, Arbitrum, Polygon, etc.)

### SignatureTransfer vs AllowanceTransfer

Permit2 has two components. **Use SignatureTransfer for x402:**

| Component | Use Case | Security |
|-----------|----------|----------|
| **SignatureTransfer** | One-time transfers | High - no hanging approvals |
| AllowanceTransfer | Time-based approvals | Lower - Paraswap hack vector |

### EIP-712 Signature Structure

```typescript
const domain = {
  name: "Permit2",
  chainId: chainId,
  verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
};

const types = {
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" }
  ],
  PermitTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};

const message = {
  permitted: {
    token: tokenAddress,
    amount: amount
  },
  spender: facilitatorAddress,
  nonce: uniqueNonce,
  deadline: expirationTimestamp
};
```

### Viem Integration

```typescript
import { signTypedData } from "viem/accounts";

const signature = await signTypedData({
  domain,
  types,
  primaryType: "PermitTransferFrom",
  message,
  privateKey
});
```

## Scheme Implementation Structure

Create new permit2 scheme following exact scheme pattern:

```
typescript/packages/mechanisms/evm/src/permit2/
├── client.ts      # createPayment() - signs Permit2 SignatureTransfer
├── server.ts      # verifyPayment() - validates signature structure
├── facilitator.ts # settlePayment() - calls Permit2.permitTransferFrom()
├── types.ts       # Permit2Payload, Permit2Config
└── index.ts       # exports + registerPermit2EvmScheme()
```

### Client Implementation Pattern

```typescript
// client.ts
export class Permit2EvmScheme implements ClientScheme<Permit2Payload> {
  constructor(private signer: PrivateKeyAccount) {}

  async createPayment(
    requirements: PaymentRequirements,
    context: ClientContext
  ): Promise<Permit2Payload> {
    // 1. Generate unique nonce
    const nonce = generateNonce();

    // 2. Set deadline (e.g., 5 minutes from now)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    // 3. Build EIP-712 message for SignatureTransfer
    const message = {
      permitted: {
        token: requirements.asset,
        amount: requirements.amount
      },
      spender: requirements.facilitator,  // x402 facilitator
      nonce,
      deadline
    };

    // 4. Sign with viem
    const signature = await this.signer.signTypedData({
      domain: getPermit2Domain(requirements.network),
      types: PERMIT2_TYPES,
      primaryType: "PermitTransferFrom",
      message
    });

    // 5. Return payload
    return {
      x402Version: 2,
      scheme: "permit2",
      network: requirements.network,
      token: requirements.asset,
      amount: requirements.amount,
      nonce,
      deadline,
      owner: this.signer.address,
      spender: requirements.facilitator,
      signature
    };
  }
}
```

### Facilitator Implementation Pattern

```typescript
// facilitator.ts
export class Permit2EvmScheme implements FacilitatorScheme<Permit2Payload> {
  constructor(
    private signer: PrivateKeyAccount,
    private networks: string[]
  ) {}

  async settlePayment(
    payload: Permit2Payload,
    requirements: PaymentRequirements
  ): Promise<SettleResult> {
    const client = getPublicClient(payload.network);
    const walletClient = getWalletClient(payload.network, this.signer);

    // Call Permit2.permitTransferFrom()
    const tx = await walletClient.writeContract({
      address: PERMIT2_ADDRESS,
      abi: PERMIT2_ABI,
      functionName: "permitTransferFrom",
      args: [
        {
          permitted: {
            token: payload.token,
            amount: payload.amount
          },
          nonce: payload.nonce,
          deadline: payload.deadline
        },
        {
          to: requirements.payTo,
          requestedAmount: payload.amount
        },
        payload.owner,
        payload.signature
      ]
    });

    return {
      success: true,
      transaction: tx
    };
  }
}
```

## Network Identifiers

Use CAIP-2 format for all network references:

| Network | Identifier |
|---------|------------|
| Anvil (local) | `eip155:31337` |
| Base Sepolia | `eip155:84532` |
| Base Mainnet | `eip155:8453` |
| Ethereum Mainnet | `eip155:1` |

## Anvil Integration

### Start with Fork (Recommended)

```bash
# Fork Base Sepolia - Permit2 already deployed
anvil --fork-url https://sepolia.base.org --chain-id 84532
```

### In TypeScript Tests

```typescript
import { createTestClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Anvil's first account
const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
);

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http("http://127.0.0.1:8545")
});

// Deploy test token, approve Permit2, test flow...
```

## Payload Type

```typescript
interface Permit2Payload {
  x402Version: 2;
  scheme: "permit2";
  network: string;              // "eip155:84532"

  // Permit2 SignatureTransfer fields
  token: `0x${string}`;         // Token contract address
  amount: bigint;               // Amount in token units
  nonce: bigint;                // Unique nonce (non-sequential OK)
  deadline: bigint;             // Unix timestamp expiration

  // Transfer details
  owner: `0x${string}`;         // Payer address (signer)
  spender: `0x${string}`;       // Facilitator address

  // EIP-712 signature
  signature: `0x${string}`;     // Full signature bytes
}
```

## Testing Strategy

### Unit Tests

```
typescript/packages/mechanisms/evm/src/permit2/__tests__/
├── client.test.ts       # Signature generation
├── server.test.ts       # Signature validation
└── facilitator.test.ts  # Settlement execution
```

### E2E Tests

```
e2e/tests/permit2.test.ts
```

Test flow:
1. Start Anvil fork
2. Deploy test token (basic ERC-20, NO permit)
3. Approve Permit2 contract
4. Create client, server, facilitator
5. Execute full payment flow
6. Verify token balances changed

## Dependencies

```json
{
  "dependencies": {
    "viem": "^2.x"
  }
}
```

Permit2 ABI available from:

- Source on [GitHub](https://github.com/Uniswap/permit2/blob/main/src/interfaces/ISignatureTransfer.sol) (which should be clones locally to /tmp)

## Documentation Requirements

When complete, create:

1. `docs/03-sdk-reference/mechanisms/evm-permit2.md`
2. Update `docs/03-sdk-reference/mechanisms/README.md`

Follow patterns in existing docs. Use V2 patterns only.

## Reference Architecture: Circle CPN

Circle's CPN validates this approach at production scale:

1. **Master Approval**: User approves Permit2 once per token
2. **Per-Payment Signature**: User signs exact amount + facilitator + deadline
3. **Settlement**: PaymentSettlement contract (≈ facilitator) calls Permit2

> "The Relayer cannot pull funds itself - only the authorized spender (PaymentSettlement contract) can execute."

This maps directly to x402's model where the facilitator is the authorized spender.

**Source:** [Circle: How CPN Uses Permit2](https://www.circle.com/blog/how-cpn-uses-permit2-to-simplify-and-secure-onchain-payments)

## Commit Style

```
feat(evm): add permit2 scheme for universal ERC-20 support

- Add client-side Permit2 SignatureTransfer signing
- Add server-side signature validation
- Add facilitator settlement via permitTransferFrom
- Add e2e tests with Anvil fork
```

Sign commits: `git commit -s -m "..."`

## Questions? Check These First

1. **How does exact scheme work?** → Read `typescript/packages/mechanisms/evm/src/exact/`
2. **How are schemes registered?** → Read `typescript/packages/core/src/client/x402Client.ts`
3. **What's the payload format?** → Read `typescript/packages/core/src/types/protocol.ts`
4. **Permit2 details?** → [Uniswap Permit2 Docs](https://docs.uniswap.org/contracts/permit2/overview)

## Research Pattern: GitHub CLI over WebFetch

**IMPORTANT:** When researching external code:

| Action | Tool | Example |
|--------|------|---------|
| Find articles/docs | WebSearch, WebFetch | Search for "Permit2 integration guide" |
| Read code from GitHub | **gh CLI** (NOT WebFetch) | `gh repo clone Uniswap/permit2 /tmp/permit2` |

```bash
# Clone repos to /tmp for local exploration
gh repo clone Uniswap/permit2 /tmp/permit2
gh repo clone dragonfly-xyz/useful-solidity-patterns /tmp/solidity-patterns

# Then read locally
cat /tmp/permit2/src/SignatureTransfer.sol
cat /tmp/permit2/src/interfaces/ISignatureTransfer.sol
```

**Why:** WebFetch on GitHub returns HTML wrappers, not raw code. Cloning gives you actual source files.

## Legacy Warning

**NEVER read or reference any path containing `/legacy/`** - these contain V1 implementations with incompatible patterns.
