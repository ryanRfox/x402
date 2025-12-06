<!-- VERIFIED: 0aa62c64 -->
# Production Deployment

Guide for deploying x402 components in production environments.

## Security Considerations

### Private Key Management

Never store private keys in code or environment files in production. Use secure key management:

```typescript
// AWS Secrets Manager
import { SecretsManager } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManager({ region: "us-east-1" });
const secret = await client.getSecretValue({ SecretId: "x402/evm-private-key" });
const privateKey = JSON.parse(secret.SecretString!).key;
```

**Recommended services:**
- AWS Secrets Manager
- HashiCorp Vault
- Google Cloud Secret Manager
- Azure Key Vault

### Network Security

1. **TLS/HTTPS** - Always use HTTPS in production
2. **Rate Limiting** - Protect against abuse
3. **Input Validation** - Validate all incoming data
4. **CORS** - Configure appropriate CORS policies

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
});

app.use(limiter);
```

### Facilitator Security

For self-hosted facilitators:

1. **Restrict Access** - Only allow trusted servers
2. **API Keys** - Require authentication
3. **IP Whitelisting** - Limit by IP address
4. **Audit Logging** - Log all operations

```typescript
const authenticatedRoutes = express.Router();

authenticatedRoutes.use((req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!isValidApiKey(apiKey)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.use("/verify", authenticatedRoutes);
app.use("/settle", authenticatedRoutes);
```

## Monitoring

### Health Checks

Implement health check endpoints:

```typescript
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    version: process.env.npm_package_version,
    uptime: process.uptime(),
  });
});

app.get("/ready", async (req, res) => {
  try {
    await server.initialize(); // Verify facilitator connection
    res.json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: error.message });
  }
});
```

### Metrics

Track key metrics:

```typescript
import { Counter, Histogram, Registry } from "prom-client";

const registry = new Registry();

const paymentsProcessed = new Counter({
  name: "x402_payments_processed_total",
  help: "Total payments processed",
  labelNames: ["status", "network"],
  registers: [registry],
});

const settlementDuration = new Histogram({
  name: "x402_settlement_duration_seconds",
  help: "Settlement duration in seconds",
  labelNames: ["network"],
  registers: [registry],
});

// Track in hooks
server.onAfterSettle(async (context) => {
  paymentsProcessed.inc({
    status: "success",
    network: context.result.network,
  });
});
```

### Logging

Structured logging for production:

```typescript
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

server.onAfterSettle(async (context) => {
  logger.info({
    event: "payment_settled",
    transaction: context.result.transaction,
    network: context.result.network,
    payer: context.result.payer,
    amount: context.requirements.amount,
  });
});
```

### Alerting

Set up alerts for critical events:

```typescript
server.onSettleFailure(async (context) => {
  await sendAlert({
    severity: "high",
    message: "Settlement failed",
    error: context.error.message,
    network: context.requirements.network,
  });
});

// Low balance alert
facilitator.onBeforeSettle(async (context) => {
  const balance = await getBalance(context.requirements.network);
  if (balance < ALERT_THRESHOLD) {
    await sendAlert({
      severity: "warning",
      message: "Low facilitator balance",
      network: context.requirements.network,
      balance: balance.toString(),
    });
  }
});
```

## Scaling

### Horizontal Scaling

Resource servers can scale horizontally behind a load balancer:

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐
    │   Server 1  │   │   Server 2  │   │   Server 3  │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                 │                 │
           └─────────────────┼─────────────────┘
                             │
                    ┌────────┴────────┐
                    │   Facilitator   │
                    └─────────────────┘
```

### Facilitator High Availability

For critical workloads, run multiple facilitators:

```typescript
const server = new x402ResourceServer([
  new HTTPFacilitatorClient({ url: "https://facilitator1.example.com" }),
  new HTTPFacilitatorClient({ url: "https://facilitator2.example.com" }),
]);
```

### Database Considerations

Track payments in a database for:
- Idempotency checks
- Analytics
- Audit trails

```typescript
server.onAfterSettle(async (context) => {
  await db.payments.insert({
    transaction: context.result.transaction,
    network: context.result.network,
    payer: context.result.payer,
    amount: context.requirements.amount,
    settledAt: new Date(),
  });
});
```

## Gas/Fee Management

### Balance Monitoring

Monitor facilitator wallet balances:

```typescript
async function checkBalances() {
  const evmBalance = await getEvmBalance(signerAddress);
  const solBalance = await getSolBalance(signerAddress);

  if (evmBalance < MIN_ETH_BALANCE) {
    await sendAlert({ message: "Low ETH balance", balance: evmBalance });
  }

  if (solBalance < MIN_SOL_BALANCE) {
    await sendAlert({ message: "Low SOL balance", balance: solBalance });
  }
}

// Check every 5 minutes
setInterval(checkBalances, 5 * 60 * 1000);
```

### Gas Price Management

For EVM networks, consider gas price strategies:

```typescript
// Use dynamic gas pricing
const gasPrice = await client.getGasPrice();
const maxGasPrice = BigInt(process.env.MAX_GAS_PRICE || "50000000000"); // 50 gwei

if (gasPrice > maxGasPrice) {
  throw new Error("Gas price too high");
}
```

### Fee Recovery

Ensure payment amounts cover settlement fees:

```typescript
// Add buffer for gas costs
const estimatedGasCost = await estimateSettlementGas(network);
const minPayment = BigInt(estimatedGasCost) * BigInt(2); // 2x buffer

if (BigInt(requirements.amount) < minPayment) {
  return { abort: true, reason: "Payment too small to cover fees" };
}
```

## Deployment Checklist

### Pre-Deployment

- [ ] Secure private key storage configured
- [ ] TLS/HTTPS enabled
- [ ] Rate limiting configured
- [ ] Health check endpoints implemented
- [ ] Logging configured
- [ ] Monitoring/alerting set up
- [ ] Database for payment tracking (optional)

### Environment

- [ ] Production environment variables set
- [ ] Mainnet RPC endpoints configured
- [ ] Facilitator wallet funded (gas + fees)
- [ ] Payee addresses verified

### Testing

- [ ] E2E tests passing
- [ ] Load testing completed
- [ ] Failover tested
- [ ] Recovery procedures documented

### Post-Deployment

- [ ] Monitor initial transactions
- [ ] Verify settlement confirmations
- [ ] Check balance consumption rate
- [ ] Review logs for errors

## Disaster Recovery

### Backup Procedures

1. **Wallet Backups** - Secure backup of all private keys
2. **Database Backups** - Regular backup of payment records
3. **Configuration Backups** - Version control for all config

### Recovery Procedures

1. **Failed Settlement** - Implement retry queue with exponential backoff
2. **Facilitator Outage** - Failover to backup facilitator
3. **Key Compromise** - Rotate keys, update configurations

```typescript
// Retry queue for failed settlements
const retryQueue = new Queue("settlement-retries", {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
});

server.onSettleFailure(async (context) => {
  await retryQueue.add("settle", {
    payload: context.paymentPayload,
    requirements: context.requirements,
  });
});
```

## Next Steps

- [Environment Setup](./environment-setup.md) - Development configuration
- [Running Tests](./running-tests.md) - Test execution guide
