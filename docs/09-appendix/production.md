# Production Deployment Guide

This guide covers deploying x402-enabled applications to production environments with a focus on security, reliability, and performance.

## Table of Contents

- [Overview](#overview)
- [Architecture Patterns](#architecture-patterns)
- [Environment Configuration](#environment-configuration)
- [Security Best Practices](#security-best-practices)
- [Facilitator Deployment](#facilitator-deployment)
- [Server Deployment](#server-deployment)
- [Client Deployment](#client-deployment)
- [Monitoring and Observability](#monitoring-and-observability)
- [Performance Optimization](#performance-optimization)
- [Scaling Strategies](#scaling-strategies)
- [Disaster Recovery](#disaster-recovery)
- [Cost Optimization](#cost-optimization)
- [Production Checklist](#production-checklist)

---

## Overview

### Production Requirements

A production x402 deployment typically includes:

1. **Application Servers**: Express, Hono, Next.js apps with payment middleware
2. **Facilitator Service**: Payment verification and settlement (local or remote)
3. **Blockchain Infrastructure**: RPC endpoints, transaction monitoring
4. **Supporting Services**: Load balancers, databases, caching, monitoring
5. **Security Infrastructure**: Secrets management, key storage, firewalls

### Deployment Models

```mermaid
flowchart TB
    subgraph Model1["Model 1: Local Facilitator"]
        Client1["Clients"]
        LB1["Load Balancer"]
        Server1A["Server Instance 1<br/>(with local facilitator)"]
        Server1B["Server Instance 2<br/>(with local facilitator)"]
        RPC1["RPC Provider<br/>(Alchemy, Infura)"]

        Client1 --> LB1
        LB1 --> Server1A
        LB1 --> Server1B
        Server1A --> RPC1
        Server1B --> RPC1
    end

    subgraph Model2["Model 2: Remote Facilitator"]
        Client2["Clients"]
        LB2["Load Balancer"]
        Server2A["Server Instance 1<br/>(stateless)"]
        Server2B["Server Instance 2<br/>(stateless)"]
        Server2C["Server Instance N<br/>(stateless)"]
        FacilitatorLB["Facilitator LB"]
        Facilitator2A["Facilitator 1"]
        Facilitator2B["Facilitator 2"]
        RPC2["RPC Provider"]

        Client2 --> LB2
        LB2 --> Server2A
        LB2 --> Server2B
        LB2 --> Server2C
        Server2A --> FacilitatorLB
        Server2B --> FacilitatorLB
        Server2C --> FacilitatorLB
        FacilitatorLB --> Facilitator2A
        FacilitatorLB --> Facilitator2B
        Facilitator2A --> RPC2
        Facilitator2B --> RPC2
    end

    style Model1 fill:#E8F4F8
    style Model2 fill:#F0F8E8
```

**Model 1: Local Facilitator**
- Simpler architecture
- Lower latency
- Each server needs blockchain access
- Harder to scale horizontally

**Model 2: Remote Facilitator**
- More complex architecture
- Shared facilitator infrastructure
- Stateless servers (easy scaling)
- Single point for security and monitoring

---

## Architecture Patterns

### Pattern 1: Simple Single-Region Deployment

```
┌─────────────┐
│   Clients   │
└──────┬──────┘
       │
┌──────▼──────────┐
│  Load Balancer  │
└──────┬──────────┘
       │
   ┌───┴────┐
   │        │
┌──▼───┐ ┌─▼────┐
│Server│ │Server│
│  +   │ │  +   │
│ Fac. │ │ Fac. │
└──┬───┘ └─┬────┘
   │       │
   └───┬───┘
       │
┌──────▼────────┐
│  RPC Provider │
└───────────────┘
```

**Use Cases**:
- Small to medium traffic
- Single geographic region
- Budget-conscious deployments
- Getting started with production

**Configuration**:
```typescript
// server.ts
import { paymentMiddleware } from "@x402/express";
import { ExactEvmService } from "@x402/evm";

// Local facilitator in each server
const facilitator = new LocalFacilitatorClient(
  createFacilitator(process.env.EVM_PRIVATE_KEY)
);

app.use(paymentMiddleware(routesConfig, facilitator, [
  { network: "eip155:8453", server: new ExactEvmService() }
]));
```

### Pattern 2: Centralized Facilitator

```
┌─────────────┐
│   Clients   │
└──────┬──────┘
       │
┌──────▼──────────┐
│  Load Balancer  │
└──────┬──────────┘
       │
   ┌───┴────────┬────────┐
   │            │        │
┌──▼───┐ ┌─────▼──┐ ┌──▼───┐
│Server│ │ Server │ │Server│
│  1   │ │   2    │ │  N   │
└──┬───┘ └─────┬──┘ └──┬───┘
   │           │       │
   └─────┬─────┴───────┘
         │
┌────────▼─────────┐
│Facilitator Cluster│
└────────┬─────────┘
         │
┌────────▼────────┐
│  RPC Provider   │
└─────────────────┘
```

**Use Cases**:
- High traffic applications
- Multiple regions
- Centralized security and monitoring
- Shared infrastructure

**Configuration**:
```typescript
// server.ts
import { HTTPFacilitatorClient } from "@x402/core/http";

// Remote facilitator
const facilitator = new HTTPFacilitatorClient(
  process.env.FACILITATOR_URL,
  "exact"
);

app.use(paymentMiddleware(routesConfig, facilitator, [
  { network: "eip155:8453", server: new ExactEvmService() }
]));
```

### Pattern 3: Multi-Region with Failover

```
Region 1 (US-East)          Region 2 (EU-West)
┌─────────────┐              ┌─────────────┐
│   Clients   │              │   Clients   │
└──────┬──────┘              └──────┬──────┘
       │                            │
┌──────▼──────────┐          ┌──────▼──────────┐
│  Load Balancer  │          │  Load Balancer  │
└──────┬──────────┘          └──────┬──────────┘
       │                            │
    Servers                      Servers
       │                            │
       └────────────┬───────────────┘
                    │
         ┌──────────▼──────────┐
         │Facilitator Primary  │
         │    (Multi-Region)   │
         └──────────┬──────────┘
                    │
                Failover
                    │
         ┌──────────▼──────────┐
         │Facilitator Secondary│
         └─────────────────────┘
```

**Use Cases**:
- Global applications
- High availability requirements
- Disaster recovery needs
- Enterprise deployments

---

## Environment Configuration

### Environment Variables

Create a comprehensive `.env` file for each environment:

```bash
# .env.production

# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# x402 Configuration
X402_VERSION=2

# Blockchain - EVM
EVM_NETWORK=eip155:8453
EVM_RPC_URL=https://mainnet.base.org
EVM_CHAIN_ID=8453
EVM_PAYEE_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

# For local facilitator only (use secrets manager in production)
# EVM_PRIVATE_KEY=0x...  # NEVER commit this!

# Blockchain - Solana (if using SVM)
SOLANA_NETWORK=solana:mainnet
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_PAYEE_ADDRESS=7KPmHQV9XkL...

# Facilitator Configuration
FACILITATOR_TYPE=remote  # or 'local'
FACILITATOR_URL=https://facilitator.example.com
FACILITATOR_TIMEOUT_MS=5000
FACILITATOR_RETRY_ATTEMPTS=3

# Payment Configuration
PAYMENT_TIMEOUT_SECONDS=300
DEFAULT_PAYMENT_SCHEME=exact
SUPPORTED_NETWORKS=eip155:8453,solana:mainnet

# Security
CORS_ORIGIN=https://app.example.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
API_KEY_HEADER=X-API-Key

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
DATADOG_API_KEY=...
PROMETHEUS_PORT=9090

# Database (if needed for tracking)
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DATABASE_POOL_SIZE=20
DATABASE_SSL=true

# Redis (for caching/rate limiting)
REDIS_URL=redis://redis.example.com:6379
REDIS_PASSWORD=...
REDIS_TLS=true

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_DISCOVERY=true
ENABLE_BATCH_SETTLEMENT=false
```

### Secrets Management

**Never store secrets in code or environment files committed to git.**

#### AWS Secrets Manager

```typescript
// secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });

export async function getSecret(secretName: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return response.SecretString || "";
}

// Load secrets at startup
async function loadSecrets() {
  if (process.env.FACILITATOR_TYPE === 'local') {
    process.env.EVM_PRIVATE_KEY = await getSecret("x402/evm-private-key");
  }
  process.env.DATABASE_URL = await getSecret("x402/database-url");
  process.env.REDIS_PASSWORD = await getSecret("x402/redis-password");
}

// In server startup
await loadSecrets();
const app = createApp();
```

#### HashiCorp Vault

```typescript
import vault from "node-vault";

const client = vault({
  apiVersion: "v1",
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN
});

async function getVaultSecret(path: string): Promise<any> {
  const result = await client.read(path);
  return result.data;
}

// Load secrets
const secrets = await getVaultSecret("secret/data/x402/production");
process.env.EVM_PRIVATE_KEY = secrets.evmPrivateKey;
```

#### Kubernetes Secrets

```yaml
# k8s-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: x402-secrets
type: Opaque
stringData:
  evm-private-key: "0x..."
  database-url: "postgresql://..."
  redis-password: "..."
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: x402-server
spec:
  template:
    spec:
      containers:
      - name: server
        image: x402-server:latest
        envFrom:
        - secretRef:
            name: x402-secrets
```

### Configuration Validation

Validate configuration at startup:

```typescript
// config.ts
import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)),

  // Blockchain
  EVM_NETWORK: z.string().regex(/^eip155:\d+$/),
  EVM_RPC_URL: z.string().url(),
  EVM_PAYEE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  // Facilitator
  FACILITATOR_TYPE: z.enum(["local", "remote"]),
  FACILITATOR_URL: z.string().url().optional(),

  // Security
  CORS_ORIGIN: z.string().url(),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function validateConfig(): Config {
  try {
    return ConfigSchema.parse(process.env);
  } catch (error) {
    console.error("Configuration validation failed:", error);
    process.exit(1);
  }
}

// Use in server
const config = validateConfig();
```

---

## Security Best Practices

### 1. Private Key Management

**Critical**: Private keys for facilitators must be protected.

#### Hardware Security Modules (HSM)

For high-security environments:

```typescript
// Using AWS KMS
import { KMSClient, SignCommand } from "@aws-sdk/client-kms";

class KMSFacilitatorSigner {
  private kms: KMSClient;
  private keyId: string;

  constructor(keyId: string) {
    this.kms = new KMSClient({ region: "us-east-1" });
    this.keyId = keyId;
  }

  async sign(message: string): Promise<string> {
    const command = new SignCommand({
      KeyId: this.keyId,
      Message: Buffer.from(message),
      SigningAlgorithm: "ECDSA_SHA_256"
    });

    const response = await this.kms.send(command);
    return Buffer.from(response.Signature!).toString('hex');
  }
}

// Use in facilitator
const signer = new KMSFacilitatorSigner(process.env.KMS_KEY_ID);
const facilitator = new x402Facilitator();
facilitator.registerScheme("eip155:8453", new ExactEvmFacilitator(signer));
```

#### Key Rotation

Implement regular key rotation:

```typescript
// key-rotation.ts
import { SecretsManagerClient, UpdateSecretCommand } from "@aws-sdk/client-secrets-manager";

async function rotateKey() {
  const newKey = generatePrivateKey(); // From viem or similar

  // Update secret
  const client = new SecretsManagerClient({ region: "us-east-1" });
  await client.send(new UpdateSecretCommand({
    SecretId: "x402/evm-private-key",
    SecretString: newKey
  }));

  // Trigger server reload or rolling restart
  await triggerGracefulRestart();
}

// Schedule rotation (every 90 days)
cron.schedule("0 0 1 */3 *", async () => {
  console.log("Starting key rotation...");
  await rotateKey();
});
```

### 2. API Security

#### Rate Limiting

Implement aggressive rate limiting:

```typescript
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

const limiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: "rl:"
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later."
});

app.use("/api/", limiter);

// Stricter limit for payment endpoints
const paymentLimiter = rateLimit({
  store: new RedisStore({ client: redis, prefix: "rl:payment:" }),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 payment attempts per minute
  skipSuccessfulRequests: true
});

app.use(paymentMiddleware(config, facilitator, schemes));
app.use("/api/protected/", paymentLimiter);
```

#### Input Validation

Validate all payment inputs:

```typescript
import { z } from "zod";

const PaymentHeaderSchema = z.string()
  .regex(/^[A-Za-z0-9+/]+=*$/, "Invalid base64 encoding")
  .transform((val) => {
    try {
      return JSON.parse(Buffer.from(val, 'base64').toString());
    } catch {
      throw new Error("Invalid payment header");
    }
  });

// In middleware
function validatePaymentHeader(req: Request): PaymentPayload {
  const header = req.headers['payment-signature'];
  if (!header) {
    throw new Error("Missing payment signature");
  }

  return PaymentHeaderSchema.parse(header);
}
```

#### CORS Configuration

Configure CORS properly:

```typescript
import cors from "cors";

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Payment-Signature',
    'Payment-Required',
    'Payment-Response'
  ],
  exposedHeaders: [
    'Payment-Required',
    'Payment-Response'
  ],
  credentials: true,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
```

### 3. Network Security

#### TLS/HTTPS

**Always use HTTPS in production**:

```typescript
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync(process.env.TLS_KEY_PATH),
  cert: fs.readFileSync(process.env.TLS_CERT_PATH),
  ca: fs.readFileSync(process.env.TLS_CA_PATH), // For client cert validation

  // Security options
  minVersion: 'TLSv1.2',
  ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384',
  honorCipherOrder: true
};

const server = https.createServer(options, app);
server.listen(443);
```

#### Firewall Rules

Configure firewall to restrict access:

```bash
# AWS Security Group (via Terraform)
resource "aws_security_group" "x402_server" {
  name = "x402-server"

  # Allow HTTPS from anywhere
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow facilitator communication (internal only)
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.facilitator.id]
  }

  # Deny direct internet access to RPC
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]  # VPC only
  }
}
```

### 4. Security Headers

Add security headers to all responses:

```typescript
import helmet from "helmet";

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FACILITATOR_URL],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));
```

---

## Facilitator Deployment

### Local Facilitator Deployment

Deploy facilitator within application servers:

```typescript
// facilitator.ts
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactEvmFacilitator, toFacilitatorEvmSigner } from "@x402/evm";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

export function createLocalFacilitator(): FacilitatorClient {
  const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

  const client = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.EVM_RPC_URL, {
      timeout: 10000,
      retryCount: 3,
      retryDelay: 1000
    })
  }).extend(publicActions);

  const facilitator = new x402Facilitator();
  facilitator.registerScheme(
    "eip155:8453",
    new ExactEvmFacilitator(toFacilitatorEvmSigner({
      readContract: (args) => client.readContract(args),
      verifyTypedData: (args) => client.verifyTypedData(args),
      writeContract: (args) => client.writeContract(args),
      waitForTransactionReceipt: (args) => client.waitForTransactionReceipt(args)
    }))
  );

  return new LocalFacilitatorClient(facilitator);
}
```

**Pros**:
- Simpler deployment
- Lower latency
- No external dependencies

**Cons**:
- Each server needs private keys
- Harder to monitor centrally
- More complex key management

### Remote Facilitator Deployment

Deploy facilitator as a separate service:

```typescript
// facilitator-service/server.ts
import express from "express";
import { x402Facilitator } from "@x402/core/facilitator";

const app = express();
app.use(express.json());

const facilitator = createLocalFacilitator(); // Same as above

// Verify endpoint
app.post("/verify", async (req, res) => {
  try {
    const { payload, requirements } = req.body;
    const result = await facilitator.verify(payload, requirements);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Settle endpoint
app.post("/settle", async (req, res) => {
  try {
    const { payload, requirements } = req.body;
    const result = await facilitator.settle(payload, requirements);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.listen(process.env.PORT || 3001);
```

**Kubernetes Deployment**:

```yaml
# facilitator-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: x402-facilitator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: x402-facilitator
  template:
    metadata:
      labels:
        app: x402-facilitator
    spec:
      containers:
      - name: facilitator
        image: x402-facilitator:latest
        ports:
        - containerPort: 3001
        env:
        - name: EVM_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: x402-secrets
              key: evm-private-key
        - name: EVM_RPC_URL
          value: "https://mainnet.base.org"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: x402-facilitator
spec:
  type: ClusterIP
  selector:
    app: x402-facilitator
  ports:
  - port: 3001
    targetPort: 3001
```

### High Availability Facilitator

Implement failover and redundancy:

```typescript
// resilient-facilitator.ts
import { HTTPFacilitatorClient } from "@x402/core/http";
import { FacilitatorClient, PaymentPayload, PaymentRequirements } from "@x402/core";

export class ResilientFacilitatorClient implements FacilitatorClient {
  private readonly endpoints: string[];
  private currentIndex = 0;

  constructor(endpoints: string[]) {
    if (endpoints.length === 0) {
      throw new Error("At least one facilitator endpoint required");
    }
    this.endpoints = endpoints;
  }

  private async executeWithFailover<T>(
    operation: (client: HTTPFacilitatorClient) => Promise<T>
  ): Promise<T> {
    const errors: Error[] = [];

    for (let attempt = 0; attempt < this.endpoints.length; attempt++) {
      const endpoint = this.endpoints[this.currentIndex];
      const client = new HTTPFacilitatorClient(endpoint, "exact");

      try {
        const result = await operation(client);
        return result;
      } catch (error) {
        console.warn(`Facilitator ${endpoint} failed:`, error);
        errors.push(error as Error);

        // Try next endpoint
        this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
      }
    }

    throw new Error(
      `All facilitators failed: ${errors.map(e => e.message).join(", ")}`
    );
  }

  async verify(payload: PaymentPayload, requirements: PaymentRequirements) {
    return this.executeWithFailover(client =>
      client.verify(payload, requirements)
    );
  }

  async settle(payload: PaymentPayload, requirements: PaymentRequirements) {
    return this.executeWithFailover(client =>
      client.settle(payload, requirements)
    );
  }

  async getSupported() {
    return this.executeWithFailover(client => client.getSupported());
  }
}

// Usage
const facilitator = new ResilientFacilitatorClient([
  "https://facilitator1.example.com",
  "https://facilitator2.example.com",
  "https://facilitator3.example.com"
]);
```

---

## Server Deployment

### Docker Containerization

Create production-ready Docker image:

```dockerfile
# Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10.7.0
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build TypeScript
RUN pnpm build

# Production image
FROM node:22-alpine

WORKDIR /app

# Install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10.7.0
RUN pnpm install --frozen-lockfile --prod

# Copy built app
COPY --from=builder /app/dist ./dist

# Security: Run as non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "dist/server.js"]
```

Build and push:

```bash
# Build
docker build -t x402-server:latest .

# Tag for registry
docker tag x402-server:latest registry.example.com/x402-server:v1.0.0

# Push
docker push registry.example.com/x402-server:v1.0.0
```

### Kubernetes Deployment

```yaml
# server-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: x402-server
  labels:
    app: x402-server
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: x402-server
  template:
    metadata:
      labels:
        app: x402-server
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      containers:
      - name: server
        image: registry.example.com/x402-server:v1.0.0
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: FACILITATOR_URL
          value: "http://x402-facilitator:3001"
        - name: EVM_PAYEE_ADDRESS
          valueFrom:
            configMapKeyRef:
              name: x402-config
              key: evm-payee-address
        envFrom:
        - secretRef:
            name: x402-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: x402-server
spec:
  type: LoadBalancer
  selector:
    app: x402-server
  ports:
  - port: 443
    targetPort: 3000
    protocol: TCP
    name: https
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: x402-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: x402-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### AWS ECS Deployment

```json
{
  "family": "x402-server",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/x402ServerRole",
  "containerDefinitions": [
    {
      "name": "x402-server",
      "image": "registry.example.com/x402-server:v1.0.0",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "FACILITATOR_URL",
          "value": "https://facilitator.example.com"
        }
      ],
      "secrets": [
        {
          "name": "EVM_PAYEE_ADDRESS",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:x402/payee-address"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/x402-server",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

---

## Client Deployment

### Browser Applications

Bundle and optimize for production:

```typescript
// webpack.config.js
module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  output: {
    filename: 'bundle.[contenthash].js',
    path: path.resolve(__dirname, 'dist')
  },
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10
        },
        x402: {
          test: /[\\/]node_modules[\\/]@x402[\\/]/,
          name: 'x402',
          priority: 20
        }
      }
    }
  },
  performance: {
    hints: 'warning',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  }
};
```

### Environment-Specific Builds

```typescript
// config.ts
const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    network: 'eip155:84532', // Base Sepolia testnet
    facilitatorUrl: 'http://localhost:3001'
  },
  staging: {
    apiUrl: 'https://staging-api.example.com',
    network: 'eip155:84532', // Base Sepolia testnet
    facilitatorUrl: 'https://staging-facilitator.example.com'
  },
  production: {
    apiUrl: 'https://api.example.com',
    network: 'eip155:8453', // Base mainnet
    facilitatorUrl: 'https://facilitator.example.com'
  }
};

export default config[process.env.NODE_ENV || 'development'];
```

### CDN Distribution

Serve static assets via CDN:

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>x402 App</title>
  <!-- Preconnect to CDN and API -->
  <link rel="preconnect" href="https://cdn.example.com">
  <link rel="preconnect" href="https://api.example.com">

  <!-- Load from CDN -->
  <script src="https://cdn.example.com/x402-app/v1.0.0/bundle.js"
          integrity="sha384-..."
          crossorigin="anonymous"></script>
</head>
<body>
  <div id="app"></div>
</body>
</html>
```

---

## Monitoring and Observability

### Application Metrics

Expose Prometheus metrics:

```typescript
// metrics.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

// Payment metrics
export const paymentAttempts = new Counter({
  name: 'x402_payment_attempts_total',
  help: 'Total number of payment attempts',
  labelNames: ['network', 'scheme', 'status'],
  registers: [register]
});

export const paymentDuration = new Histogram({
  name: 'x402_payment_duration_seconds',
  help: 'Duration of payment verification and settlement',
  labelNames: ['network', 'scheme', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

export const activePayments = new Gauge({
  name: 'x402_active_payments',
  help: 'Number of payments currently being processed',
  labelNames: ['network'],
  registers: [register]
});

// Facilitator metrics
export const facilitatorRequests = new Counter({
  name: 'x402_facilitator_requests_total',
  help: 'Total facilitator requests',
  labelNames: ['operation', 'status'],
  registers: [register]
});

// Blockchain metrics
export const gasUsed = new Histogram({
  name: 'x402_gas_used',
  help: 'Gas used for settlement transactions',
  labelNames: ['network'],
  buckets: [50000, 100000, 150000, 200000, 250000],
  registers: [register]
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Structured Logging

Use structured logs for better observability:

```typescript
// logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'x402-server',
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// Log payment events
logger.info('Payment received', {
  paymentId: payment.id,
  network: payment.network,
  amount: payment.amount,
  from: payment.from,
  transactionHash: payment.transactionHash
});

logger.error('Payment verification failed', {
  paymentId: payment.id,
  error: error.message,
  stack: error.stack
});
```

### Distributed Tracing

Implement OpenTelemetry:

```typescript
// tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'x402-server'
});

sdk.start();

// Use in payment flow
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('x402-payment');

async function processPayment(payload: PaymentPayload) {
  const span = tracer.startSpan('process_payment', {
    attributes: {
      'payment.network': payload.network,
      'payment.scheme': payload.scheme
    }
  });

  try {
    const verification = await facilitator.verify(payload, requirements);
    span.setAttribute('verification.status', verification.success);

    const settlement = await facilitator.settle(payload, requirements);
    span.setAttribute('settlement.txHash', settlement.transactionHash);

    span.setStatus({ code: SpanStatusCode.OK });
    return settlement;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    throw error;
  } finally {
    span.end();
  }
}
```

### Error Tracking

Integrate Sentry or similar:

```typescript
// error-tracking.ts
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new ProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

// Error handling middleware
app.use(Sentry.Handlers.errorHandler());

// Capture payment errors
try {
  await processPayment(payload);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      payment_network: payload.network,
      payment_scheme: payload.scheme
    },
    contexts: {
      payment: {
        payload: payload,
        requirements: requirements
      }
    }
  });
  throw error;
}
```

### Dashboards

Create Grafana dashboard for monitoring:

```json
{
  "dashboard": {
    "title": "x402 Production Metrics",
    "panels": [
      {
        "title": "Payment Success Rate",
        "targets": [
          {
            "expr": "rate(x402_payment_attempts_total{status=\"success\"}[5m]) / rate(x402_payment_attempts_total[5m])"
          }
        ]
      },
      {
        "title": "Payment Duration (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(x402_payment_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Gas Used per Settlement",
        "targets": [
          {
            "expr": "rate(x402_gas_used_sum[5m]) / rate(x402_gas_used_count[5m])"
          }
        ]
      },
      {
        "title": "Facilitator Error Rate",
        "targets": [
          {
            "expr": "rate(x402_facilitator_requests_total{status=\"error\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

---

## Performance Optimization

### Caching Strategies

Implement multi-layer caching:

```typescript
// cache.ts
import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';

const redis = new Redis(process.env.REDIS_URL);

// In-memory cache for hot data
const memoryCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 5 // 5 minutes
});

// Cache verification results
export async function getCachedVerification(
  paymentHash: string
): Promise<VerifyResponse | null> {
  // Check memory cache first
  let result = memoryCache.get(paymentHash);
  if (result) return result;

  // Check Redis
  const cached = await redis.get(`verification:${paymentHash}`);
  if (cached) {
    result = JSON.parse(cached);
    memoryCache.set(paymentHash, result);
    return result;
  }

  return null;
}

export async function cacheVerification(
  paymentHash: string,
  result: VerifyResponse,
  ttlSeconds: number = 300
): Promise<void> {
  memoryCache.set(paymentHash, result);
  await redis.setex(
    `verification:${paymentHash}`,
    ttlSeconds,
    JSON.stringify(result)
  );
}
```

### Connection Pooling

Optimize database and RPC connections:

```typescript
// db.ts
import { Pool } from 'pg';

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true
  } : false
});

// RPC client pooling
import { createPublicClient, http } from 'viem';

export const rpcClient = createPublicClient({
  transport: http(process.env.EVM_RPC_URL, {
    batch: {
      batchSize: 100,
      wait: 50 // ms
    },
    retryCount: 3,
    retryDelay: 1000,
    timeout: 10000
  })
});
```

### Request Batching

Batch RPC requests:

```typescript
// batch-rpc.ts
class BatchedRPCClient {
  private pendingRequests: Array<{
    method: string;
    params: any[];
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  private batchTimeout: NodeJS.Timeout | null = null;

  async call(method: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({ method, params, resolve, reject });

      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => this.executeBatch(), 50);
      }
    });
  }

  private async executeBatch() {
    const batch = this.pendingRequests.splice(0);
    this.batchTimeout = null;

    if (batch.length === 0) return;

    try {
      const results = await rpcClient.multicall({
        contracts: batch.map(req => ({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: req.method,
          args: req.params
        }))
      });

      batch.forEach((req, i) => {
        const result = results[i];
        if (result.status === 'success') {
          req.resolve(result.result);
        } else {
          req.reject(result.error);
        }
      });
    } catch (error) {
      batch.forEach(req => req.reject(error));
    }
  }
}
```

### Async Settlement

Don't block responses on settlement:

```typescript
// async-settlement.ts
import { Queue, Worker } from 'bullmq';

const settlementQueue = new Queue('settlement', {
  connection: redis
});

// Queue settlement for async processing
export async function queueSettlement(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): Promise<void> {
  await settlementQueue.add('settle', {
    payload,
    requirements,
    timestamp: Date.now()
  });
}

// Worker processes settlements
const worker = new Worker('settlement', async (job) => {
  const { payload, requirements } = job.data;

  try {
    const result = await facilitator.settle(payload, requirements);
    logger.info('Settlement completed', {
      jobId: job.id,
      txHash: result.transactionHash
    });
    return result;
  } catch (error) {
    logger.error('Settlement failed', {
      jobId: job.id,
      error: error.message
    });
    throw error;
  }
}, {
  connection: redis,
  concurrency: 5
});

// In middleware
async function handlePayment(req, res) {
  // Verify payment
  const verification = await facilitator.verify(payload, requirements);

  if (verification.success) {
    // Queue settlement (don't wait)
    await queueSettlement(payload, requirements);

    // Respond immediately
    res.json({
      message: "Payment accepted",
      settlementQueued: true
    });
  } else {
    res.status(402).json({ error: "Payment verification failed" });
  }
}
```

---

## Scaling Strategies

### Horizontal Scaling

Scale application servers independently:

```yaml
# Auto-scaling based on metrics
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: x402-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: x402-server
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: x402_active_payments
      target:
        type: AverageValue
        averageValue: "100"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

### Database Scaling

Use read replicas for high read loads:

```typescript
// db-pool.ts
import { Pool } from 'pg';

// Primary for writes
export const primaryDb = new Pool({
  connectionString: process.env.PRIMARY_DATABASE_URL,
  max: 10
});

// Replicas for reads
const replicas = [
  process.env.REPLICA1_DATABASE_URL,
  process.env.REPLICA2_DATABASE_URL,
  process.env.REPLICA3_DATABASE_URL
].filter(Boolean);

const replicaPools = replicas.map(url => new Pool({
  connectionString: url,
  max: 20
}));

let replicaIndex = 0;

export function getReadPool(): Pool {
  if (replicaPools.length === 0) return primaryDb;

  const pool = replicaPools[replicaIndex];
  replicaIndex = (replicaIndex + 1) % replicaPools.length;
  return pool;
}

// Usage
await primaryDb.query('INSERT INTO payments ...'); // Write
const result = await getReadPool().query('SELECT * FROM payments ...'); // Read
```

### CDN and Edge Caching

Cache static payment requirements at the edge:

```typescript
// edge-cache.ts
app.get('/api/payment-requirements/:endpoint', (req, res) => {
  const requirements = getPaymentRequirements(req.params.endpoint);

  // Cache at CDN for 1 hour
  res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.set('CDN-Cache-Control', 'max-age=3600');

  res.json(requirements);
});
```

### Geographic Distribution

Deploy in multiple regions:

```
US-East              EU-West              APAC
┌────────┐          ┌────────┐          ┌────────┐
│Servers │◄────────►│Servers │◄────────►│Servers │
└───┬────┘          └───┬────┘          └───┬────┘
    │                   │                   │
    └───────────────┬───┴───────────────────┘
                    │
              ┌─────▼─────┐
              │Facilitator│
              │  Cluster  │
              └───────────┘
```

Use GeoDNS for routing:

```
// Route53 geolocation records
resource "aws_route53_record" "x402_us" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "A"

  geolocation_routing_policy {
    continent = "NA"
  }

  alias {
    name                   = aws_lb.us_east.dns_name
    zone_id                = aws_lb.us_east.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "x402_eu" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "A"

  geolocation_routing_policy {
    continent = "EU"
  }

  alias {
    name                   = aws_lb.eu_west.dns_name
    zone_id                = aws_lb.eu_west.zone_id
    evaluate_target_health = true
  }
}
```

---

## Disaster Recovery

### Backup Strategy

Implement comprehensive backups:

```bash
#!/bin/bash
# backup.sh

# Database backup
pg_dump $DATABASE_URL | gzip > "backup-$(date +%Y%m%d-%H%M%S).sql.gz"
aws s3 cp backup-*.sql.gz s3://x402-backups/database/

# Redis backup
redis-cli --rdb /tmp/dump.rdb
aws s3 cp /tmp/dump.rdb s3://x402-backups/redis/

# Configuration backup
kubectl get all -n x402-prod -o yaml > k8s-backup.yaml
aws s3 cp k8s-backup.yaml s3://x402-backups/k8s/

# Secrets backup (encrypted)
kubectl get secrets -n x402-prod -o yaml | \
  openssl enc -aes-256-cbc -pass file:/path/to/key > secrets-encrypted.yaml
aws s3 cp secrets-encrypted.yaml s3://x402-backups/secrets/
```

### Recovery Procedures

Document recovery steps:

```markdown
# Disaster Recovery Runbook

## Scenario 1: Database Failure

1. Identify failure:
   ```bash
   kubectl logs -n x402-prod deployment/x402-server --tail=100
   ```

2. Promote read replica:
   ```bash
   aws rds promote-read-replica --db-instance-identifier x402-replica-1
   ```

3. Update connection strings:
   ```bash
   kubectl set env deployment/x402-server \
     DATABASE_URL=postgresql://new-primary...
   ```

4. Verify:
   ```bash
   kubectl exec -it deployment/x402-server -- node -e \
     "require('pg').Pool({connectionString: process.env.DATABASE_URL}).query('SELECT 1')"
   ```

## Scenario 2: Complete Region Failure

1. Update DNS to failover region:
   ```bash
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z123... \
     --change-batch file://failover.json
   ```

2. Scale up backup region:
   ```bash
   kubectl scale deployment/x402-server --replicas=10 -n x402-prod-backup
   ```

3. Monitor health:
   ```bash
   watch kubectl get pods -n x402-prod-backup
   ```
```

### Transaction Replay

Handle incomplete settlements:

```typescript
// replay.ts
async function replayPendingSettlements() {
  // Find pending settlements
  const pending = await db.query(`
    SELECT * FROM settlements
    WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '5 minutes'
  `);

  for (const settlement of pending.rows) {
    try {
      // Check on-chain status
      const receipt = await rpcClient.getTransactionReceipt({
        hash: settlement.tx_hash
      });

      if (receipt) {
        // Transaction succeeded
        await db.query(
          'UPDATE settlements SET status = $1, block_number = $2 WHERE id = $3',
          ['completed', receipt.blockNumber, settlement.id]
        );
      } else {
        // Transaction not found, retry
        const result = await facilitator.settle(
          settlement.payload,
          settlement.requirements
        );

        await db.query(
          'UPDATE settlements SET tx_hash = $1, status = $2 WHERE id = $3',
          [result.transactionHash, 'completed', settlement.id]
        );
      }
    } catch (error) {
      logger.error('Settlement replay failed', {
        settlementId: settlement.id,
        error: error.message
      });
    }
  }
}

// Run periodically
setInterval(replayPendingSettlements, 60000); // Every minute
```

---

## Cost Optimization

### RPC Cost Optimization

Reduce RPC costs with caching and batching:

```typescript
// rpc-optimizer.ts
class OptimizedRPCClient {
  private cache = new LRUCache({ max: 1000, ttl: 60000 });
  private batchQueue: any[] = [];

  async readContract(args: any) {
    const cacheKey = JSON.stringify(args);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    // Add to batch
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ args, resolve, reject });

      // Execute batch after short delay
      if (this.batchQueue.length === 1) {
        setTimeout(() => this.executeBatch(), 10);
      }
    });
  }

  private async executeBatch() {
    const batch = this.batchQueue.splice(0);
    if (batch.length === 0) return;

    try {
      // Single multicall instead of N calls
      const results = await rpcClient.multicall({
        contracts: batch.map(b => b.args)
      });

      batch.forEach((item, i) => {
        const result = results[i];
        const cacheKey = JSON.stringify(item.args);

        if (result.status === 'success') {
          this.cache.set(cacheKey, result.result);
          item.resolve(result.result);
        } else {
          item.reject(result.error);
        }
      });
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }
  }
}

// Savings: 100 individual calls → 1 multicall
// Cost reduction: ~99%
```

### Gas Optimization

Optimize settlement gas costs:

```typescript
// gas-optimizer.ts
async function estimateAndOptimizeGas(tx: any) {
  // Get current gas price
  const gasPrice = await rpcClient.getGasPrice();

  // Use lower gas price during off-peak
  const hour = new Date().getUTCHours();
  const isOffPeak = hour >= 2 && hour <= 8; // UTC 2am-8am

  const optimizedGasPrice = isOffPeak
    ? gasPrice * 80n / 100n // 20% discount during off-peak
    : gasPrice;

  return {
    ...tx,
    gasPrice: optimizedGasPrice,
    maxFeePerGas: optimizedGasPrice * 120n / 100n, // 20% buffer
    maxPriorityFeePerGas: 1n * 10n**9n // 1 gwei tip
  };
}

// Batch settlements to save gas
async function batchSettlements(settlements: Settlement[]) {
  if (settlements.length === 1) {
    return await settleSingle(settlements[0]);
  }

  // Batch settlement costs less gas per settlement
  return await settleMultiple(settlements);
}
```

### Infrastructure Cost Monitoring

Track cloud costs:

```typescript
// cost-tracking.ts
import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";

async function getWeeklyCosts() {
  const client = new CostExplorerClient({ region: "us-east-1" });

  const command = new GetCostAndUsageCommand({
    TimePeriod: {
      Start: getDateWeekAgo(),
      End: getDateToday()
    },
    Granularity: "DAILY",
    Metrics: ["UnblendedCost"],
    GroupBy: [
      {
        Type: "DIMENSION",
        Key: "SERVICE"
      }
    ],
    Filter: {
      Tags: {
        Key: "Project",
        Values: ["x402"]
      }
    }
  });

  const response = await client.send(command);

  // Alert if costs exceed threshold
  const totalCost = calculateTotalCost(response);
  if (totalCost > WEEKLY_BUDGET) {
    await sendAlert(`Weekly costs ($${totalCost}) exceed budget ($${WEEKLY_BUDGET})`);
  }

  return response;
}
```

---

## Production Checklist

### Pre-Deployment Checklist

- [ ] **Security**
  - [ ] All secrets in secrets manager (not environment files)
  - [ ] Private keys in HSM or secure storage
  - [ ] TLS/HTTPS enabled with valid certificates
  - [ ] CORS configured correctly
  - [ ] Rate limiting enabled
  - [ ] Input validation on all endpoints
  - [ ] Security headers configured (helmet.js)
  - [ ] Firewall rules restrict unnecessary access

- [ ] **Configuration**
  - [ ] Environment variables validated and documented
  - [ ] Correct network IDs (mainnet, not testnet)
  - [ ] Payee addresses verified
  - [ ] RPC URLs pointing to production endpoints
  - [ ] Facilitator URL configured
  - [ ] Database connection strings correct
  - [ ] Redis configured with persistence

- [ ] **Monitoring**
  - [ ] Prometheus metrics exposed
  - [ ] Grafana dashboards created
  - [ ] Logging configured (structured JSON logs)
  - [ ] Error tracking enabled (Sentry, etc.)
  - [ ] Alerting rules configured
  - [ ] Health check endpoints implemented
  - [ ] Distributed tracing set up

- [ ] **Performance**
  - [ ] Caching strategy implemented
  - [ ] Connection pooling configured
  - [ ] Request batching enabled where applicable
  - [ ] CDN configured for static assets
  - [ ] Database indexes optimized
  - [ ] Load testing completed

- [ ] **Scalability**
  - [ ] Horizontal pod autoscaling configured
  - [ ] Load balancer configured
  - [ ] Stateless architecture verified
  - [ ] Database read replicas set up (if needed)
  - [ ] Facilitator high availability configured

- [ ] **Disaster Recovery**
  - [ ] Backup strategy implemented and tested
  - [ ] Recovery procedures documented
  - [ ] Multi-region failover configured (if needed)
  - [ ] Transaction replay mechanism tested
  - [ ] Incident response runbook created

- [ ] **Testing**
  - [ ] Integration tests passing
  - [ ] Load tests completed successfully
  - [ ] Security audit performed
  - [ ] Penetration testing completed
  - [ ] Chaos engineering tests (optional but recommended)

- [ ] **Documentation**
  - [ ] API documentation up to date
  - [ ] Runbooks created for common scenarios
  - [ ] Architecture diagrams current
  - [ ] On-call procedures documented
  - [ ] Rollback procedures documented

- [ ] **Compliance**
  - [ ] Privacy policy reviewed
  - [ ] Terms of service updated
  - [ ] Data retention policy implemented
  - [ ] GDPR compliance verified (if applicable)
  - [ ] Audit logging enabled

### Post-Deployment Checklist

- [ ] Monitor error rates for 24 hours
- [ ] Verify all metrics are reporting correctly
- [ ] Check database performance and slow queries
- [ ] Verify facilitator is processing settlements
- [ ] Review transaction success rates
- [ ] Confirm RPC costs are within budget
- [ ] Test rollback procedure
- [ ] Update status page
- [ ] Notify stakeholders of successful deployment

---

## Additional Resources

- [12-Factor App Methodology](https://12factor.net/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Production Best Practices: Performance and Reliability](https://expressjs.com/en/advanced/best-practice-performance.html)
- [OWASP Security Best Practices](https://owasp.org/www-project-web-security-testing-guide/)

---

*This guide provides a comprehensive foundation for deploying x402 to production. Adapt these patterns to your specific infrastructure and requirements.*
