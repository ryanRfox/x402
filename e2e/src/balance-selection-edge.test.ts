import { selectPaymentMethod, PaymentMethod, BalanceChecker } from './balance-aware-selector';

/**
 * Balance-Aware Selector Tests - Group E: Edge Cases
 *
 * Tests E1-E2 validating edge case scenarios.
 *
 * | #  | Scenario                                           | Expected                    |
 * |----|----------------------------------------------------|-----------------------------|
 * | E1 | Server offers only Base USDC, client has Solana   | null (no compatible method) |
 * | E2 | Server offers EIP-3009 and Permit2, client has USDC| EIP-3009 (server first)    |
 */

interface TestResult {
  testNumber: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

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

const formatMethod = (method: PaymentMethod | null): string => {
  if (!method) return 'null';
  return `${method.asset.toUpperCase()} via ${method.protocol} on ${method.network}`;
};

async function runTests(): Promise<void> {
  console.log('\n🧪 Balance-Aware Selector Tests - Group E: Edge Cases\n');
  console.log('═'.repeat(60));

  const results: TestResult[] = [];

  // Test E1: No overlap between server offers and client capabilities
  // Server offers: Base USDC only
  // Client has: Solana USDC only
  // Expected: null (no compatible method) - graceful error
  try {
    const serverAccepts = [BASE_USDC_EIP3009]; // Server only accepts Base USDC

    const balanceChecker: BalanceChecker = async (method: PaymentMethod) => {
      // Client only has Solana USDC - no balance for Base
      if (method.network.startsWith('solana:') && method.asset === 'usdc') {
        return 1000000n; // 1 USDC (6 decimals)
      }
      return 0n; // No balance for Base USDC
    };

    const selected = await selectPaymentMethod(serverAccepts, balanceChecker);
    const passed = selected === null;

    results.push({
      testNumber: 'E1',
      name: 'Server Base only, Client Solana only → null',
      passed,
      expected: 'null',
      actual: formatMethod(selected),
    });

    if (passed) {
      console.log(`\n  ✅ E1: Server Base only, Client Solana only → null (no overlap)`);
    } else {
      console.log(`\n  ❌ E1: Server Base only, Client Solana only`);
      console.log(`      Expected: null`);
      console.log(`      Actual:   ${formatMethod(selected)}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      testNumber: 'E1',
      name: 'Server Base only, Client Solana only → null',
      passed: false,
      expected: 'null',
      actual: 'exception (should not throw)',
      error: errorMsg,
    });
    console.log(`\n  ❌ E1: Server Base only, Client Solana only`);
    console.log(`      Error: Should return null, not throw: ${errorMsg}`);
  }

  // Test E2: Server offers multiple protocols for same asset
  // Server offers: Base USDC EIP-3009, Base USDC Permit2 (in that order)
  // Client has: USDC balance
  // Expected: EIP-3009 (first in server preference)
  try {
    const serverAccepts = [BASE_USDC_EIP3009, BASE_USDC_PERMIT2];

    const balanceChecker: BalanceChecker = async (method: PaymentMethod) => {
      // Client has USDC on Base (works with both protocols)
      if (method.network === 'eip155:84532' && method.asset === 'usdc') {
        return 1000000n; // 1 USDC (6 decimals)
      }
      return 0n;
    };

    const selected = await selectPaymentMethod(serverAccepts, balanceChecker);
    const expected = BASE_USDC_EIP3009; // First method wins

    const passed =
      selected !== null &&
      selected.asset === expected.asset &&
      selected.network === expected.network &&
      selected.protocol === expected.protocol;

    results.push({
      testNumber: 'E2',
      name: 'EIP-3009 + Permit2 → EIP-3009 (first)',
      passed,
      expected: formatMethod(expected),
      actual: formatMethod(selected),
    });

    if (passed) {
      console.log(`  ✅ E2: EIP-3009 + Permit2 → ${formatMethod(selected)} (first)`);
    } else {
      console.log(`  ❌ E2: EIP-3009 + Permit2`);
      console.log(`      Expected: ${formatMethod(expected)}`);
      console.log(`      Actual:   ${formatMethod(selected)}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      testNumber: 'E2',
      name: 'EIP-3009 + Permit2 → EIP-3009 (first)',
      passed: false,
      expected: formatMethod(BASE_USDC_EIP3009),
      actual: 'exception',
      error: errorMsg,
    });
    console.log(`  ❌ E2: EIP-3009 + Permit2`);
    console.log(`      Error: ${errorMsg}`);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n📊 Test Summary - Group E: Edge Cases');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📈 Total:  ${results.length}\n`);

  if (failed > 0) {
    console.log('❌ FAILED TESTS:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  • ${r.testNumber}: ${r.name}`);
        console.log(`    Expected: ${r.expected}`);
        console.log(`    Actual: ${r.actual}`);
        if (r.error) {
          console.log(`    Error: ${r.error}`);
        }
      });
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
