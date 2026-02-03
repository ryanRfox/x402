import { selectPaymentMethod, PaymentMethod, BalanceChecker } from './balance-aware-selector';

/**
 * Balance-Aware Selector Tests - Group B: Client Preference
 *
 * These tests validate that the client can override the server's preferred
 * payment method ordering using the clientPreference parameter.
 */

interface TestResult {
  testNumber: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string | null;
  error?: string;
}

const BASE_USDC: PaymentMethod = {
  asset: 'USDC',
  network: 'eip155:84532',
  protocol: 'eip3009',
};

const SOLANA_USDC: PaymentMethod = {
  asset: 'USDC',
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  protocol: 'spl-transfer',
};

// Balance checker that returns positive balance for both methods
const bothHaveBalance: BalanceChecker = async () => 1000000n;

// Helper to identify payment method
const methodId = (m: PaymentMethod | null): string => {
  if (!m) return 'null';
  return `${m.network}:${m.asset}`;
};

// Client preference: prefer Solana over Base
const preferSolana = (methods: PaymentMethod[]): PaymentMethod[] => {
  return [...methods].sort((a, b) => {
    const aIsSolana = a.network.startsWith('solana:');
    const bIsSolana = b.network.startsWith('solana:');
    if (aIsSolana && !bIsSolana) return -1;
    if (!aIsSolana && bIsSolana) return 1;
    return 0;
  });
};

// Client preference: prefer Base over Solana
const preferBase = (methods: PaymentMethod[]): PaymentMethod[] => {
  return [...methods].sort((a, b) => {
    const aIsBase = a.network.startsWith('eip155:');
    const bIsBase = b.network.startsWith('eip155:');
    if (aIsBase && !bIsBase) return -1;
    if (!aIsBase && bIsBase) return 1;
    return 0;
  });
};

async function runTests(): Promise<void> {
  console.log('\n🧪 Balance-Aware Selector Tests - Group B: Client Preference\n');
  console.log('═'.repeat(60));

  const results: TestResult[] = [];

  // Test B1: Server order is Base first, Client prefers Solana, Client has Both
  // Expected: Solana USDC
  try {
    const serverAccepts = [BASE_USDC, SOLANA_USDC]; // Base first
    const selected = await selectPaymentMethod(serverAccepts, bothHaveBalance, preferSolana);

    const passed = selected !== null && selected.network.startsWith('solana:');
    results.push({
      testNumber: 'B1',
      name: 'Server prefers Base, Client prefers Solana',
      passed,
      expected: methodId(SOLANA_USDC),
      actual: methodId(selected),
    });

    if (passed) {
      console.log(`  ✅ B1: Server prefers Base, Client prefers Solana → ${methodId(selected)}`);
    } else {
      console.log(`  ❌ B1: Server prefers Base, Client prefers Solana`);
      console.log(`      Expected: ${methodId(SOLANA_USDC)}`);
      console.log(`      Actual:   ${methodId(selected)}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      testNumber: 'B1',
      name: 'Server prefers Base, Client prefers Solana',
      passed: false,
      expected: methodId(SOLANA_USDC),
      actual: 'error',
      error: errorMsg,
    });
    console.log(`  ❌ B1: Server prefers Base, Client prefers Solana`);
    console.log(`      Error: ${errorMsg}`);
  }

  // Test B2: Server order is Solana first, Client prefers Base, Client has Both
  // Expected: Base USDC
  try {
    const serverAccepts = [SOLANA_USDC, BASE_USDC]; // Solana first
    const selected = await selectPaymentMethod(serverAccepts, bothHaveBalance, preferBase);

    const passed = selected !== null && selected.network.startsWith('eip155:');
    results.push({
      testNumber: 'B2',
      name: 'Server prefers Solana, Client prefers Base',
      passed,
      expected: methodId(BASE_USDC),
      actual: methodId(selected),
    });

    if (passed) {
      console.log(`  ✅ B2: Server prefers Solana, Client prefers Base → ${methodId(selected)}`);
    } else {
      console.log(`  ❌ B2: Server prefers Solana, Client prefers Base`);
      console.log(`      Expected: ${methodId(BASE_USDC)}`);
      console.log(`      Actual:   ${methodId(selected)}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      testNumber: 'B2',
      name: 'Server prefers Solana, Client prefers Base',
      passed: false,
      expected: methodId(BASE_USDC),
      actual: 'error',
      error: errorMsg,
    });
    console.log(`  ❌ B2: Server prefers Solana, Client prefers Base`);
    console.log(`      Error: ${errorMsg}`);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n📊 Test Summary - Group B: Client Preference');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📈 Total:  ${results.length}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests when executed directly
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
