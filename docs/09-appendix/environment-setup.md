# Environment Setup

Development environment configuration for working with x402 v2.

## Tool Installation

### mise

Install mise for tool version management:

```bash
curl https://mise.jdx.dev/install.sh | sh
```

### Project Setup

```bash
cd x402
mise install      # Install all tools from .mise.toml
mise trust        # Trust the configuration
```

## Required Tools

- Node.js: 22.x (>=18.0.0)
- pnpm: 10.7.0
- Python: 3.13.x (>=3.10)
- Go: 1.23.3
- Java: 17.x
- Maven: latest

## Environment Variables

Create `.env` file in project root:

```bash
# Required for e2e tests
SERVER_EVM_ADDRESS=0x...
SERVER_SVM_ADDRESS=...
CLIENT_EVM_PRIVATE_KEY=0x...
CLIENT_SVM_PRIVATE_KEY=...

# Optional
SERVER_PORT=4021
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
```

## Build and Test

```bash
# Install dependencies
pnpm install

# Build packages
cd typescript
pnpm build

# Run e2e tests
cd e2e
pnpm test -d
```

---

*See [CLAUDE.md](../../../CLAUDE.md) for complete development guide*
