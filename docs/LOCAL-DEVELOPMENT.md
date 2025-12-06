# Local Development Guide

This guide explains how to work with the x402 V2 SDK locally. **Critical for avoiding V1 npm packages.**

## The Problem

If you run:
```bash
npm install @x402/core @x402/express @x402/evm
```

You will get **V1 packages from npm** - these have different APIs and will not work with V2 documentation or patterns.

## The Solution

The x402 repository is a **pnpm monorepo**. All V2 packages are in `typescript/packages/` and must be used locally.

## Repository Structure

```
x402/
├── typescript/                 # V2 SDK monorepo
│   ├── package.json           # Monorepo root (pnpm + turbo)
│   ├── pnpm-workspace.yaml    # Workspace configuration
│   └── packages/
│       ├── core/              # @x402/core
│       ├── http/
│       │   ├── express/       # @x402/express
│       │   ├── fetch/         # @x402/fetch
│       │   ├── axios/         # @x402/axios
│       │   ├── hono/          # @x402/hono
│       │   └── next/          # @x402/next
│       └── mechanisms/
│           ├── evm/           # @x402/evm
│           └── svm/           # @x402/svm
├── e2e/                       # End-to-end tests (uses workspace:*)
├── examples/typescript/       # Examples (uses workspace:*)
└── demo/                      # Your prototype space
```

## Setup: Build Local Packages

Before using any x402 packages, build them:

```bash
cd typescript
pnpm install
pnpm build
```

This compiles all packages and makes them available for local use.

## Method 1: Inside the Monorepo (Recommended)

If your code is inside the monorepo (e.g., `demo/`, `e2e/`, `examples/`), use the **workspace protocol**:

```json
{
  "dependencies": {
    "@x402/core": "workspace:*",
    "@x402/express": "workspace:*",
    "@x402/evm": "workspace:*",
    "@x402/fetch": "workspace:*"
  }
}
```

Then run from the **repository root**:
```bash
pnpm install
```

The workspace protocol ensures pnpm links to local packages, not npm.

## Method 2: Outside the Monorepo (file: protocol)

If your code is outside the monorepo, use the **file: protocol** to reference built packages:

```json
{
  "dependencies": {
    "@x402/core": "file:../path/to/x402/typescript/packages/core",
    "@x402/express": "file:../path/to/x402/typescript/packages/http/express",
    "@x402/evm": "file:../path/to/x402/typescript/packages/mechanisms/evm",
    "@x402/fetch": "file:../path/to/x402/typescript/packages/http/fetch"
  }
}
```

Example for a demo in `/tmp/my-demo`:
```json
{
  "dependencies": {
    "@x402/core": "file:/Users/fox/Getting Started/x402/typescript/packages/core",
    "@x402/evm": "file:/Users/fox/Getting Started/x402/typescript/packages/mechanisms/evm"
  }
}
```

Then:
```bash
npm install
```

## Method 3: npm link (Alternative)

```bash
# In the package directory
cd typescript/packages/core
npm link

# In your project
cd /tmp/my-demo
npm link @x402/core
```

Repeat for each package needed.

## Verifying You Have V2

Check your imports match V2 patterns:

```typescript
// V2 - CORRECT
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

const client = new x402Client();
registerExactEvmScheme(client, { signer });

// V1 - WRONG (will fail with V2 docs)
import { ExactEvmClient } from "@x402/evm";
const client = new ExactEvmClient(signer);
```

## Creating a New Demo

### Inside Monorepo (Recommended)

```bash
# Create demo folder
mkdir -p demo/my-experiment
cd demo/my-experiment

# Create package.json with workspace references
cat > package.json << 'EOF'
{
  "name": "my-experiment",
  "private": true,
  "type": "module",
  "dependencies": {
    "@x402/core": "workspace:*",
    "@x402/evm": "workspace:*",
    "@x402/fetch": "workspace:*",
    "viem": "^2.0.0"
  }
}
EOF

# Install from repository root
cd ../..
pnpm install

# Run your demo
cd demo/my-experiment
npx tsx index.ts
```

### Outside Monorepo

```bash
# Create project
mkdir /tmp/my-experiment
cd /tmp/my-experiment
npm init -y

# Add dependencies with file: protocol
npm install file:/path/to/x402/typescript/packages/core \
            file:/path/to/x402/typescript/packages/mechanisms/evm \
            file:/path/to/x402/typescript/packages/http/fetch \
            viem
```

## Common Issues

### "Module not found" Errors

1. Ensure packages are built: `cd typescript && pnpm build`
2. Check package.json uses `workspace:*` or `file:` (not version numbers)
3. Run `pnpm install` from repository root

### Getting V1 Instead of V2

1. Check package.json - remove any `"@x402/*": "^0.x.x"` version numbers
2. Replace with `workspace:*` or `file:` protocol
3. Delete `node_modules` and reinstall

### TypeScript Errors

Ensure your tsconfig.json has:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2022"
  }
}
```

## For Claude Instances

**CRITICAL RULES:**

1. **NEVER** run `npm install @x402/core` or any `@x402/*` package from npm
2. **ALWAYS** use `workspace:*` for code inside the monorepo
3. **ALWAYS** use `file:` protocol for code outside the monorepo
4. **ALWAYS** build packages first: `cd typescript && pnpm install && pnpm build`
5. **ALWAYS** verify imports match V2 patterns (registration functions, not class instantiation)

## Quick Reference

| Location | Protocol | Example |
|----------|----------|---------|
| Inside monorepo | `workspace:*` | `"@x402/core": "workspace:*"` |
| Outside monorepo | `file:` | `"@x402/core": "file:../typescript/packages/core"` |
| npm | **NEVER** | Do not use npm for x402 packages |
