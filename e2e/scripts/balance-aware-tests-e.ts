/**
 * Balance-Aware Selection Tests (Group E: Edge Cases)
 *
 * Tests E1-E2 validating edge case scenarios.
 *
 * | #  | Scenario                                           | Expected                    |
 * |----|----------------------------------------------------|-----------------------------|
 * | E1 | Server offers only Base USDC, client has Solana   | null (no compatible method) |
 * | E2 | Server offers EIP-3009 and Permit2, client has USDC| EIP-3009 (server first)    |
 *
 * Usage:
 *   pnpm tsx scripts/balance-aware-tests-e.ts
 */

import {
  selectPaymentMethod,
  PaymentMethod,
  BalanceChecker,
} from '../src/balance-aware-selector';

// Payment methods for edge case testing
const BASE_USDC_EIP3009: PaymentMethod = {
  asset: 'usdc',
  network: 'eip155:84532', // Base Sepolia
  protocol: 'eip3009',
};

const BASE_USDC_PERMIT2: PaymentMethod = {
  asset: 'usdc',
  network: 'eip155:84532', // Base Sepolia
  protocol: 'permit2',
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
 * Test E1: No overlap between server offers and client capabilities
 * Server offers: Base USDC only
 * Client has: Solana USDC only
 * Expected: null (no compatible method) - graceful error
 */
async function testE1(): Promise<TestResult> {
  const testName = 'E1: Server Base only, Client Solana only → Error';
  log(`\n🧪 ${testName}`);

  const serverAccepts = [BASE_USDC_EIP3009]; // Server only accepts Base USDC

  const balanceChecker: BalanceChecker = async (method: PaymentMethod) => {
    // Client only has Solana USDC - no balance for Base
    if (method.network.startsWith('solana:') && method.asset === 'usdc') {
      return 1000000n; // 1 USDC (6 decimals)
    }
    return 0n; // No balance for Base USDC
  };

  try {
    const selected = await selectPaymentMethod(serverAccepts, balanceChecker);

    // Expected: null because client has no balance for any server-accepted method
    const passed = selected === null;

    const result: TestResult = {
      name: testName,
      passed,
      expected: 'null (no compatible method)',
      actual: formatMethod(selected),
    };

    if (passed) {
      log(`  ✅ Passed: Gracefully returned null (no overlap)`);
    } else {
      log(`  ❌ Failed: Expected null, got ${formatMethod(selected)}`);
    }

    return result;
  } catch (error) {
    // Should not throw - should return null gracefully
    const result: TestResult = {
      name: testName,
      passed: false,
      expected: 'null (no compatible method)',
      actual: 'exception (should not throw)',
      error: error instanceof Error ? error.message : String(error),
    };
    log(`  ❌ Failed: Should return null, not throw: ${result.error}`);
    return result;
  }
}

/**
 * Test E2: Server offers multiple protocols for same asset
 * Server offers: Base USDC EIP-3009, Base USDC Permit2 (in that order)
 * Client has: USDC balance
 * Expected: EIP-3009 (first in server preference)
 */
async function testE2(): Promise<TestResult> {
  const testName = 'E2: Server offers EIP-3009 + Permit2, Client has USDC → EIP-3009';
  log(`\n🧪 ${testName}`);

  // Server lists EIP-3009 first, then Permit2
  const serverAccepts = [BASE_USDC_EIP3009, BASE_USDC_PERMIT2];

  const balanceChecker: BalanceChecker = async (method: PaymentMethod) => {
    // Client has USDC on Base (works with both protocols)
    if (method.network === 'eip155:84532' && method.asset === 'usdc') {
      return 1000000n; // 1 USDC (6 decimals)
    }
    return 0n;
  };

  try {
    const selected = await selectPaymentMethod(serverAccepts, balanceChecker);
    const expected = BASE_USDC_EIP3009; // First method wins

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
      log(`  ✅ Passed: Selected EIP-3009 (server's first choice)`);
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

async function main(): Promise<void> {
  log('🚀 Balance-Aware Selection Tests (Group E: Edge Cases)');
  log('=======================================================');
  log('');
  log('Testing edge case scenarios for selectPaymentMethod');

  // Run Group E tests
  results.push(await testE1());
  results.push(await testE2());

  // Summary
  log('\n📊 Test Summary - Group E: Edge Cases');
  log('======================================');

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

  log('✅ All Group E edge case tests passed!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});
