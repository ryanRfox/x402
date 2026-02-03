/**
 * Balance-Aware Selection Tests (Group C)
 *
 * Tests C1-C3 validating balance-aware fallback behavior.
 * The selectPaymentMethod function should iterate through payment methods
 * in server preference order and select the first one with sufficient balance.
 *
 * | #  | Server Order                | Client Has    | Expected                      |
 * |----|-----------------------------| --------------|-------------------------------|
 * | C1 | Base USDC, WETH, Solana     | WETH only     | WETH Permit2                  |
 * | C2 | Base USDC, WETH, Solana     | Solana only   | Solana USDC                   |
 * | C3 | Base USDC, WETH, Solana     | None          | Error (no compatible method)  |
 *
 * Usage:
 *   pnpm tsx scripts/balance-aware-tests.ts
 */

import {
  selectPaymentMethod,
  PaymentMethod,
  BalanceChecker,
} from '../src/balance-aware-selector';

// Payment methods matching the multi-method /protected endpoint
// Order matches server preference: Base USDC EIP-3009, WETH Permit2, Solana USDC
const PAYMENT_METHODS: PaymentMethod[] = [
  {
    asset: 'usdc',
    network: 'eip155:84532', // Base Sepolia
    protocol: 'eip3009',
  },
  {
    asset: 'weth',
    network: 'eip155:84532', // Base Sepolia
    protocol: 'permit2',
  },
  {
    asset: 'usdc',
    network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', // Solana Devnet
    protocol: 'exact',
  },
];

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
 * Test C1: Client has WETH only
 * Server offers: Base USDC, WETH, Solana
 * Expected: WETH Permit2 (first method with balance)
 */
async function testC1(): Promise<TestResult> {
  const testName = 'C1: WETH only → WETH Permit2';
  log(`\n🧪 ${testName}`);

  const balanceChecker: BalanceChecker = async (method: PaymentMethod) => {
    // Client only has WETH
    if (method.asset === 'weth' && method.network === 'eip155:84532') {
      return 1000000000000000000n; // 1 WETH
    }
    return 0n; // No balance for other assets
  };

  try {
    const selected = await selectPaymentMethod(PAYMENT_METHODS, balanceChecker);
    const expected = PAYMENT_METHODS[1]; // WETH Permit2

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
      expected: formatMethod(PAYMENT_METHODS[1]),
      actual: 'exception',
      error: error instanceof Error ? error.message : String(error),
    };
    log(`  ❌ Failed with exception: ${result.error}`);
    return result;
  }
}

/**
 * Test C2: Client has Solana USDC only
 * Server offers: Base USDC, WETH, Solana
 * Expected: Solana USDC (third method, first with balance)
 */
async function testC2(): Promise<TestResult> {
  const testName = 'C2: Solana only → Solana USDC';
  log(`\n🧪 ${testName}`);

  const balanceChecker: BalanceChecker = async (method: PaymentMethod) => {
    // Client only has Solana USDC
    if (method.asset === 'usdc' && method.network.startsWith('solana:')) {
      return 1000000n; // 1 USDC (6 decimals)
    }
    return 0n; // No balance for other assets
  };

  try {
    const selected = await selectPaymentMethod(PAYMENT_METHODS, balanceChecker);
    const expected = PAYMENT_METHODS[2]; // Solana USDC

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
      expected: formatMethod(PAYMENT_METHODS[2]),
      actual: 'exception',
      error: error instanceof Error ? error.message : String(error),
    };
    log(`  ❌ Failed with exception: ${result.error}`);
    return result;
  }
}

/**
 * Test C3: Client has no compatible balances
 * Server offers: Base USDC, WETH, Solana
 * Expected: null (no compatible method) - should NOT crash
 */
async function testC3(): Promise<TestResult> {
  const testName = 'C3: No balance → Error (graceful null)';
  log(`\n🧪 ${testName}`);

  const balanceChecker: BalanceChecker = async (_method: PaymentMethod) => {
    // Client has no balances
    return 0n;
  };

  try {
    const selected = await selectPaymentMethod(PAYMENT_METHODS, balanceChecker);

    // Expected behavior: return null, not throw
    const passed = selected === null;

    const result: TestResult = {
      name: testName,
      passed,
      expected: 'null (no compatible method)',
      actual: formatMethod(selected),
    };

    if (passed) {
      log(`  ✅ Passed: Gracefully returned null (no compatible method)`);
    } else {
      log(`  ❌ Failed: Expected null, got ${formatMethod(selected)}`);
    }

    return result;
  } catch (error) {
    // If it throws, that's a failure - C3 should gracefully return null
    const result: TestResult = {
      name: testName,
      passed: false,
      expected: 'null (no compatible method)',
      actual: 'exception (should not throw)',
      error: error instanceof Error ? error.message : String(error),
    };
    log(`  ❌ Failed: Should not throw, got exception: ${result.error}`);
    return result;
  }
}

/**
 * Additional test: Verify first match wins
 * When client has multiple balances, should return first in server order
 */
async function testFirstMatchWins(): Promise<TestResult> {
  const testName = 'Bonus: First match wins (has all balances)';
  log(`\n🧪 ${testName}`);

  const balanceChecker: BalanceChecker = async (_method: PaymentMethod) => {
    // Client has all balances
    return 1000000n;
  };

  try {
    const selected = await selectPaymentMethod(PAYMENT_METHODS, balanceChecker);
    const expected = PAYMENT_METHODS[0]; // First method (Base USDC EIP-3009)

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
      log(`  ✅ Passed: Selected first method ${formatMethod(selected)}`);
    } else {
      log(`  ❌ Failed: Expected first method ${formatMethod(expected)}, got ${formatMethod(selected)}`);
    }

    return result;
  } catch (error) {
    const result: TestResult = {
      name: testName,
      passed: false,
      expected: formatMethod(PAYMENT_METHODS[0]),
      actual: 'exception',
      error: error instanceof Error ? error.message : String(error),
    };
    log(`  ❌ Failed with exception: ${result.error}`);
    return result;
  }
}

async function main(): Promise<void> {
  log('🚀 Balance-Aware Selection Tests (Group C)');
  log('==========================================');
  log('');
  log('Testing selectPaymentMethod with different balance scenarios');
  log('Payment methods in server preference order:');
  PAYMENT_METHODS.forEach((m, i) => {
    log(`  ${i + 1}. ${formatMethod(m)}`);
  });

  // Run Group C tests
  results.push(await testC1());
  results.push(await testC2());
  results.push(await testC3());
  results.push(await testFirstMatchWins());

  // Summary
  log('\n📊 Test Summary');
  log('===============');

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

  log('✅ All balance-aware selection tests passed!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});
