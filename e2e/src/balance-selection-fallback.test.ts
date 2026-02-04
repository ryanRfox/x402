import { selectPaymentMethod, PaymentMethod, BalanceChecker } from './balance-aware-selector';

/**
 * Balance-Aware Selector Tests - Group C: Balance-Aware Fallback
 *
 * Tests C1-C3 validating balance-aware fallback behavior.
 * The selectPaymentMethod function should iterate through payment methods
 * in server preference order and select the first one with sufficient balance.
 *
 * | #  | Server Order                | Client Has    | Expected                      |
 * |----|-----------------------------| --------------|-------------------------------|
 * | C1 | Base USDC, WETH, Solana     | WETH only     | WETH Permit2                  |
 * | C2 | Base USDC, WETH, Solana     | Solana only   | Solana USDC                   |
 * | C3 | Base USDC, WETH, Solana     | None          | null (no compatible method)   |
 */

interface TestResult {
  testNumber: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

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

const formatMethod = (method: PaymentMethod | null): string => {
  if (!method) return 'null';
  return `${method.asset.toUpperCase()} via ${method.protocol} on ${method.network}`;
};

async function runTests(): Promise<void> {
  console.log('\n🧪 Balance-Aware Selector Tests - Group C: Balance-Aware Fallback\n');
  console.log('═'.repeat(60));
  console.log('\nPayment methods in server preference order:');
  PAYMENT_METHODS.forEach((m, i) => {
    console.log(`  ${i + 1}. ${formatMethod(m)}`);
  });

  const results: TestResult[] = [];

  // Test C1: Client has WETH only
  // Server offers: Base USDC, WETH, Solana
  // Expected: WETH Permit2 (first method with balance)
  try {
    const balanceChecker: BalanceChecker = async (method: PaymentMethod) => {
      if (method.asset === 'weth' && method.network === 'eip155:84532') {
        return 1000000000000000000n; // 1 WETH
      }
      return 0n;
    };

    const selected = await selectPaymentMethod(PAYMENT_METHODS, balanceChecker);
    const expected = PAYMENT_METHODS[1]; // WETH Permit2

    const passed =
      selected !== null &&
      selected.asset === expected.asset &&
      selected.network === expected.network &&
      selected.protocol === expected.protocol;

    results.push({
      testNumber: 'C1',
      name: 'WETH only → WETH Permit2',
      passed,
      expected: formatMethod(expected),
      actual: formatMethod(selected),
    });

    if (passed) {
      console.log(`\n  ✅ C1: WETH only → ${formatMethod(selected)}`);
    } else {
      console.log(`\n  ❌ C1: WETH only`);
      console.log(`      Expected: ${formatMethod(expected)}`);
      console.log(`      Actual:   ${formatMethod(selected)}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      testNumber: 'C1',
      name: 'WETH only → WETH Permit2',
      passed: false,
      expected: formatMethod(PAYMENT_METHODS[1]),
      actual: 'exception',
      error: errorMsg,
    });
    console.log(`\n  ❌ C1: WETH only`);
    console.log(`      Error: ${errorMsg}`);
  }

  // Test C2: Client has Solana USDC only
  // Server offers: Base USDC, WETH, Solana
  // Expected: Solana USDC (third method, first with balance)
  try {
    const balanceChecker: BalanceChecker = async (method: PaymentMethod) => {
      if (method.asset === 'usdc' && method.network.startsWith('solana:')) {
        return 1000000n; // 1 USDC (6 decimals)
      }
      return 0n;
    };

    const selected = await selectPaymentMethod(PAYMENT_METHODS, balanceChecker);
    const expected = PAYMENT_METHODS[2]; // Solana USDC

    const passed =
      selected !== null &&
      selected.asset === expected.asset &&
      selected.network === expected.network &&
      selected.protocol === expected.protocol;

    results.push({
      testNumber: 'C2',
      name: 'Solana only → Solana USDC',
      passed,
      expected: formatMethod(expected),
      actual: formatMethod(selected),
    });

    if (passed) {
      console.log(`  ✅ C2: Solana only → ${formatMethod(selected)}`);
    } else {
      console.log(`  ❌ C2: Solana only`);
      console.log(`      Expected: ${formatMethod(expected)}`);
      console.log(`      Actual:   ${formatMethod(selected)}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      testNumber: 'C2',
      name: 'Solana only → Solana USDC',
      passed: false,
      expected: formatMethod(PAYMENT_METHODS[2]),
      actual: 'exception',
      error: errorMsg,
    });
    console.log(`  ❌ C2: Solana only`);
    console.log(`      Error: ${errorMsg}`);
  }

  // Test C3: Client has no compatible balances
  // Server offers: Base USDC, WETH, Solana
  // Expected: null (no compatible method) - should NOT crash
  try {
    const balanceChecker: BalanceChecker = async () => 0n;

    const selected = await selectPaymentMethod(PAYMENT_METHODS, balanceChecker);
    const passed = selected === null;

    results.push({
      testNumber: 'C3',
      name: 'No balance → null',
      passed,
      expected: 'null',
      actual: formatMethod(selected),
    });

    if (passed) {
      console.log(`  ✅ C3: No balance → null (graceful)`);
    } else {
      console.log(`  ❌ C3: No balance`);
      console.log(`      Expected: null`);
      console.log(`      Actual:   ${formatMethod(selected)}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      testNumber: 'C3',
      name: 'No balance → null',
      passed: false,
      expected: 'null',
      actual: 'exception (should not throw)',
      error: errorMsg,
    });
    console.log(`  ❌ C3: No balance`);
    console.log(`      Error: Should return null, not throw: ${errorMsg}`);
  }

  // Bonus: First match wins (when client has all balances)
  try {
    const balanceChecker: BalanceChecker = async () => 1000000n;

    const selected = await selectPaymentMethod(PAYMENT_METHODS, balanceChecker);
    const expected = PAYMENT_METHODS[0]; // First method (Base USDC EIP-3009)

    const passed =
      selected !== null &&
      selected.asset === expected.asset &&
      selected.network === expected.network &&
      selected.protocol === expected.protocol;

    results.push({
      testNumber: 'C+',
      name: 'All balances → First method',
      passed,
      expected: formatMethod(expected),
      actual: formatMethod(selected),
    });

    if (passed) {
      console.log(`  ✅ C+: All balances → ${formatMethod(selected)} (first)`);
    } else {
      console.log(`  ❌ C+: All balances (first match wins)`);
      console.log(`      Expected: ${formatMethod(expected)}`);
      console.log(`      Actual:   ${formatMethod(selected)}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      testNumber: 'C+',
      name: 'All balances → First method',
      passed: false,
      expected: formatMethod(PAYMENT_METHODS[0]),
      actual: 'exception',
      error: errorMsg,
    });
    console.log(`  ❌ C+: All balances`);
    console.log(`      Error: ${errorMsg}`);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n📊 Test Summary - Group C: Balance-Aware Fallback');
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
