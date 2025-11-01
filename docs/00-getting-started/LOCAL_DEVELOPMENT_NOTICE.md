# ⚠️ CRITICAL: x402 v2 SDK Local Development Notice

**Last Updated**: 2025-10-31
**Affects**: All x402 v2 SDK packages
**Status**: NOT PUBLISHED TO NPM

---

## Important: Packages Not Published to npm

The x402 v2 SDK packages are **currently in development** and are **NOT published to npm**. All packages exist only in this local repository.

### What This Means

❌ **This will NOT work**:
```bash
npm install @x402/fetch @x402/evm @x402/express
# ERROR: Package not found on npm registry
```

✅ **You must use local file paths**:
```bash
npm install file:/path/to/x402/typescript/packages/http/fetch
```

---

## Installation Methods for Local Packages

### Method 1: Absolute File Paths (Recommended)

Install packages using absolute `file:` URLs:

```bash
# Replace /path/to/x402 with your actual path
npm install \
  file:/Users/fox/Getting\ Started/x402/typescript/packages/http/fetch \
  file:/Users/fox/Getting\ Started/x402/typescript/packages/mechanisms/evm \
  file:/Users/fox/Getting\ Started/x402/typescript/packages/core \
  viem
```

**Pros**:
- Works from any directory
- Clear and explicit
- No symlink issues

**Cons**:
- Paths are machine-specific
- Must update if x402 repo moves

### Method 2: Relative File Paths

If your project is adjacent to x402:

```bash
# Assuming structure:
# /projects/x402/
# /projects/my-app/

npm install \
  file:../x402/typescript/packages/http/fetch \
  file:../x402/typescript/packages/mechanisms/evm \
  file:../x402/typescript/packages/core \
  viem
```

**Pros**:
- Portable across machines
- Works well for related projects

**Cons**:
- Requires specific directory structure
- Path relativity can be confusing

### Method 3: npm link (Not Recommended for x402)

**DO NOT USE `npm link` for x402 v2 packages**. The monorepo structure with pnpm workspaces can cause issues with npm link.

```bash
# ❌ Don't do this
cd x402/typescript/packages/http/fetch
npm link
cd your-project
npm link @x402/fetch
```

**Why not**: Workspace dependencies may not resolve correctly.

### Method 4: pnpm Workspaces (For Development)

If you're developing x402 itself, use pnpm workspaces:

```bash
# In x402 repo
cd x402
pnpm install  # Installs all workspace packages
```

Then reference packages with `workspace:*` in package.json.

---

## Correct Installation by Package

### Client Application

```bash
# Full command with absolute paths
npm install \
  file:/Users/fox/Getting\ Started/x402/typescript/packages/http/fetch \
  file:/Users/fox/Getting\ Started/x402/typescript/packages/mechanisms/evm \
  file:/Users/fox/Getting\ Started/x402/typescript/packages/core \
  viem
```

**package.json result**:
```json
{
  "dependencies": {
    "@x402/fetch": "file:../x402/typescript/packages/http/fetch",
    "@x402/evm": "file:../x402/typescript/packages/mechanisms/evm",
    "@x402/core": "file:../x402/typescript/packages/core",
    "viem": "^2.21.48"
  }
}
```

### Server Application

```bash
# Full command with absolute paths
npm install \
  file:/Users/fox/Getting\ Start/x402/typescript/packages/http/express \
  file:/Users/fox/Getting\ Started/x402/typescript/packages/core \
  file:/Users/fox/Getting\ Started/x402/typescript/packages/mechanisms/evm \
  express \
  viem
```

---

## Package Locations Reference

Quick reference for all x402 v2 package paths:

| Package | Path |
|---------|------|
| @x402/core | `typescript/packages/core` |
| @x402/fetch | `typescript/packages/http/fetch` |
| @x402/axios | `typescript/packages/http/axios` |
| @x402/express | `typescript/packages/http/express` |
| @x402/hono | `typescript/packages/http/hono` |
| @x402/next | `typescript/packages/http/next` |
| @x402/evm | `typescript/packages/mechanisms/evm` |
| @x402/svm | `typescript/packages/mechanisms/svm` |
| @x402/extensions | `typescript/packages/extensions` |
| @x402/paywall | `typescript/packages/paywall` |

**Base path**: `/Users/fox/Getting Started/x402/` (adjust for your system)

---

## Why Aren't Packages Published?

The x402 v2 SDK is in **active development** on the `v2-development` branch. Packages will be published to npm when:

1. ✅ API is stable
2. ✅ Tests pass consistently
3. ✅ Documentation is complete
4. ✅ Release candidate is approved
5. ✅ v2.0.0 is tagged and merged to main

**Current status**: Development phase, pre-release

---

## Common Issues & Solutions

### Issue 1: "Package not found" Error

**Error**:
```
npm ERR! 404 Not Found - GET https://registry.npmjs.org/@x402/fetch
```

**Solution**: Use `file:` paths instead of package names.

### Issue 2: "Cannot find module" at Runtime

**Error**:
```
Error: Cannot find module '@x402/core'
```

**Causes**:
- Symlink issues with npm link
- Incorrect relative paths
- Missing peer dependencies

**Solution**: Use absolute `file:` paths and ensure all dependencies are installed.

### Issue 3: Typescript Can't Find Types

**Error**:
```
Cannot find module '@x402/fetch' or its corresponding type declarations
```

**Solution**: Ensure you're using `file:` installs, which copy the built packages with .d.ts files.

### Issue 4: Outdated Local Package

**Problem**: Changes to x402 repo don't appear in your project.

**Solution**: Reinstall the package:
```bash
npm install file:/path/to/x402/typescript/packages/http/fetch --force
```

Or remove and reinstall:
```bash
rm -rf node_modules/@x402
npm install
```

---

## Best Practices

### 1. Document Your x402 Path

In your project README:
```markdown
## x402 SDK Path

This project uses x402 v2 SDK from local development repository:
- Path: `/Users/fox/Getting Started/x402`
- Branch: `v2-development` (or upstream/v2-development)
- Update: `cd /path/to/x402 && git pull upstream v2-development`
```

### 2. Use Environment Variables (Optional)

```bash
# In your shell profile
export X402_PATH="/Users/fox/Getting Started/x402"

# In package.json scripts
{
  "scripts": {
    "install:x402": "npm install file:$X402_PATH/typescript/packages/http/fetch ..."
  }
}
```

### 3. Keep x402 Repo Updated

Regularly update your local x402 repo:
```bash
cd "/Users/fox/Getting Started/x402"
git fetch upstream
git checkout upstream/v2-development  # Or your local branch
pnpm install  # Rebuild packages
pnpm build    # Build TypeScript
```

Then reinstall in your projects.

### 4. Verify Package Versions

Check which version you're using:
```bash
# In your project
cat node_modules/@x402/core/package.json | grep version
```

Compare with x402 repo:
```bash
# In x402 repo
cat typescript/packages/core/package.json | grep version
```

---

## Migration to npm Packages (Future)

When x402 v2 packages are published to npm, you can migrate:

**Before (local)**:
```json
{
  "dependencies": {
    "@x402/fetch": "file:../x402/typescript/packages/http/fetch"
  }
}
```

**After (npm)**:
```json
{
  "dependencies": {
    "@x402/fetch": "^2.0.0"
  }
}
```

Then:
```bash
rm -rf node_modules/@x402
npm install
```

---

## Questions?

**Q**: When will packages be published to npm?
**A**: When v2.0.0 is released (currently in development).

**Q**: Can I publish my own fork to npm?
**A**: Check the license (Apache-2.0) and consider using a different package scope (e.g., `@yourorg/x402-fetch`).

**Q**: Do I need to rebuild x402 packages after pulling updates?
**A**: Yes. Run `pnpm build` in the x402 repo after pulling updates.

**Q**: Can I use yarn instead of npm/pnpm?
**A**: Yes, yarn also supports `file:` protocol. Use `yarn add file:/path/to/package`.

---

**⚠️ Remember: Always use `file:` paths for x402 v2 packages until they're published to npm!**
