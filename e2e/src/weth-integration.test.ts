/**
 * WETH Integration Tests (Group D)
 *
 * Tests D1-D2 validating WETH wrap/unwrap scenarios with balance-aware selection.
 *
 * | #  | Before Test       | Server Prefers | Expected                    |
 * |----|-------------------|----------------|-----------------------------|
 * | D1 | Unwrap all WETH   | WETH first     | Falls back to next available|
 * | D2 | Wrap ETH → WETH   | WETH first     | Uses WETH Permit2           |
 *
 * Usage:
 *   pnpm tsx src/weth-integration.test.ts
 */

import {
  selectPaymentMethod,
  PaymentMethod,
  BalanceChecker,
} from './balance-aware-selector';

// Payment methods - WETH first (server preference for these tests)
const WETH_PERMIT2: PaymentMethod = {
  asset: 'weth',
  network: 'eip155:84532', // Base Sepolia
  protocol: 'permit2',
};

const BASE_USDC_EIP3009: PaymentMethod = {
  asset: 'usdc',
  network: 'eip155:84532', // Base Sepolia
  protocol: 'eip3009',
};

const SOLANA_USDC: PaymentMethod = {
  asset: 'usdc',
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', // Solana Devnet
  protocol: 'exact',
};

interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

const results: TestResult[] = [];

function log(msg: string): void {
  console.log(msg);
}

function formatMethod(method: PaymentMethod | null): string {
  if (!method) return 'null (no compatible method)';
  return `${method.asset.toUpperCase()} via ${method.protocol} on ${method.network}`;
}

/**
 * Test D1: Client has unwrapped all WETH (no WETH balance)
 * Server offers: WETH first, then Base USDC, then Solana
 * Client has: Base USDC only (simulating post-unwrap state)
 * Expected: Falls back to Base USDC EIP-3009
 */
async function testD1(): Promise<TestResult> {
  const testName = 'D1: Unwrap all WETH → Falls back to Base USDC';
  log(`\n🧪 ${testName}`);

  // Server prefers WETH first
  const serverAccepts = [WETH_PERMIT2, BASE_USDC_EIP3009, SOLANA_USDC];

  // Client has unwrapped all WETH - only has Base USDC now
  const balanceChecker: BalanceChecker = async (method: PaymentMethod) => {
    if (method.asset === 'weth') {
      return 0n; // No WETH after unwrap
    }
    if (method.asset === 'usdc' && method.network === 'eip155:84532') {
      return 1000000n; // 1 USDC on Base
    }
    return 0n; // No Solana balance
  };

  try {
    const selected = await selectPaymentMethod(serverAccepts, balanceChecker);
    const expected = BASE_USDC_EIP3009; // Should fall back to Base USDC

    const passed =
      selected !== null &&
      selected.asset === expected.asset &&
      selected.network === expected.network &&
      selected.protocol === expected.protocol;

    const result: TestResult = {
      name: testName,
      passed,
      expected: formatMethod(expected),
      actual: formatMethod(selected),
    };

    if (passed) {
      log(`  ✅ Passed: Falls back to ${formatMethod(selected)}`);
    } else {
      log(`  ❌ Failed: Expected ${formatMethod(expected)}, got ${formatMethod(selected)}`);
    }

    return result;
  } catch (error) {
    const result: TestResult = {
      name: testName,
      passed: false,
      expected: formatMethod(BASE_USDC_EIP3009),
      actual: 'exception',
      error: error instanceof Error ? error.message : String(error),
    };
    log(`  ❌ Failed with exception: ${result.error}`);
    return result;
  }
}

/**
 * Test D2: Client has wrapped ETH → WETH (has WETH balance)
 * Server offers: WETH first, then Base USDC
 * Client has: WETH (simulating post-wrap state)
 * Expected: Uses WETH Permit2 (server's preferred method)
 */
async function testD2(): Promise<TestResult> {
  const testName = 'D2: Wrap ETH → WETH → Uses WETH Permit2';
  log(`\n🧪 ${testName}`);

  // Server prefers WETH first
  const serverAccepts = [WETH_PERMIT2, BASE_USDC_EIP3009];

  // Client has wrapped ETH to WETH - now has WETH balance
  const balanceChecker: BalanceChecker = async (method: PaymentMethod) => {
    if (method.asset === 'weth' && method.network === 'eip155:84532') {
      return 1000000000000000000n; // 1 WETH (18 decimals)
    }
    return 0n; // No other balances
  };

  try {
    const selected = await selectPaymentMethod(serverAccepts, balanceChecker);
    const expected = WETH_PERMIT2; // Should use WETH Permit2

    const passed =
      selected !== null &&
      selected.asset === expected.asset &&
      selected.network === expected.network &&
      selected.protocol === expected.protocol;

    const result: TestResult = {
      name: testName,
      passed,
      expected: formatMethod(expected),
      actual: formatMethod(selected),
    };

    if (passed) {
      log(`  ✅ Passed: Selected ${formatMethod(selected)}`);
    } else {
      log(`  ❌ Failed: Expected ${formatMethod(expected)}, got ${formatMethod(selected)}`);
    }

    return result;
  } catch (error) {
    const result: TestResult = {
      name: testName,
      passed: false,
      expected: formatMethod(WETH_PERMIT2),
      actual: 'exception',
      error: error instanceof Error ? error.message : String(error),
    };
    log(`  ❌ Failed with exception: ${result.error}`);
    return result;
  }
}

async function main(): Promise<void> {
  log('🚀 WETH Integration Tests (Group D)');
  log('====================================');
  log('');
  log('Testing WETH wrap/unwrap scenarios with balance-aware selection');
  log('Server preference order: WETH Permit2 first');

  // Run Group D tests
  results.push(await testD1());
  results.push(await testD2());

  // Summary
  log('\n📊 Test Summary - Group D: WETH Integration');
  log('============================================');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  log(`✅ Passed: ${passed}`);
  log(`❌ Failed: ${failed}`);
  log(`📈 Total: ${results.length}`);
  log('');

  if (failed > 0) {
    log('❌ FAILED TESTS:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        log(`  • ${r.name}`);
        log(`    Expected: ${r.expected}`);
        log(`    Actual: ${r.actual}`);
        if (r.error) {
          log(`    Error: ${r.error}`);
        }
      });
    log('');
    process.exit(1);
  }

  log('✅ All Group D WETH integration tests passed!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});
