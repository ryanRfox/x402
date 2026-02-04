import { selectPaymentMethod, PaymentMethod, BalanceChecker } from './balance-aware-selector';

/**
 * Balance-Aware Selector Tests - Group A: Server Preference
 *
 * These tests validate that the server's preferred payment method ordering
 * is respected when no client preference is provided.
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

const WETH: PaymentMethod = {
  asset: 'WETH',
  network: 'eip155:84532',
  protocol: 'permit2',
};

// Balance checker that returns positive balance for all methods
const hasAllBalances: BalanceChecker = async () => 1000000n;

// Balance checker that has WETH and Solana but NOT Base USDC
const noBaseUSDC: BalanceChecker = async (method: PaymentMethod) => {
  if (method.asset === 'USDC' && method.network.startsWith('eip155:')) {
    return 0n;
  }
  return 1000000n;
};

// Helper to identify payment method
const methodId = (m: PaymentMethod | null): string => {
  if (!m) return 'null';
  return `${m.network}:${m.asset}`;
};

async function runTests(): Promise<void> {
  console.log('\n🧪 Balance-Aware Selector Tests - Group A: Server Preference\n');
  console.log('═'.repeat(60));

  const results: TestResult[] = [];

  // Test A1: Server accepts Base USDC, Solana USDC; Client has Both
  // Expected: Base USDC EIP-3009 (first in server order)
  try {
    const serverAccepts = [BASE_USDC, SOLANA_USDC];
    const selected = await selectPaymentMethod(serverAccepts, hasAllBalances);

    const passed = selected !== null &&
      selected.network === BASE_USDC.network &&
      selected.protocol === 'eip3009';
    results.push({
      testNumber: 'A1',
      name: 'Server prefers Base, Client has Both',
      passed,
      expected: methodId(BASE_USDC),
      actual: methodId(selected),
    });

    if (passed) {
      console.log(`  ✅ A1: Server prefers Base, Client has Both → ${methodId(selected)}`);
    } else {
      console.log(`  ❌ A1: Server prefers Base, Client has Both`);
      console.log(`      Expected: ${methodId(BASE_USDC)}`);
      console.log(`      Actual:   ${methodId(selected)}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      testNumber: 'A1',
      name: 'Server prefers Base, Client has Both',
      passed: false,
      expected: methodId(BASE_USDC),
      actual: 'error',
      error: errorMsg,
    });
    console.log(`  ❌ A1: Server prefers Base, Client has Both`);
    console.log(`      Error: ${errorMsg}`);
  }

  // Test A2: Server accepts Solana USDC, Base USDC; Client has Both
  // Expected: Solana USDC (first in server order)
  try {
    const serverAccepts = [SOLANA_USDC, BASE_USDC];
    const selected = await selectPaymentMethod(serverAccepts, hasAllBalances);

    const passed = selected !== null && selected.network.startsWith('solana:');
    results.push({
      testNumber: 'A2',
      name: 'Server prefers Solana, Client has Both',
      passed,
      expected: methodId(SOLANA_USDC),
      actual: methodId(selected),
    });

    if (passed) {
      console.log(`  ✅ A2: Server prefers Solana, Client has Both → ${methodId(selected)}`);
    } else {
      console.log(`  ❌ A2: Server prefers Solana, Client has Both`);
      console.log(`      Expected: ${methodId(SOLANA_USDC)}`);
      console.log(`      Actual:   ${methodId(selected)}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      testNumber: 'A2',
      name: 'Server prefers Solana, Client has Both',
      passed: false,
      expected: methodId(SOLANA_USDC),
      actual: 'error',
      error: errorMsg,
    });
    console.log(`  ❌ A2: Server prefers Solana, Client has Both`);
    console.log(`      Error: ${errorMsg}`);
  }

  // Test A3: Server accepts Base USDC, WETH, Solana; Client has No Base USDC, has WETH
  // Expected: WETH Permit2 (first available in server order)
  try {
    const serverAccepts = [BASE_USDC, WETH, SOLANA_USDC];
    const selected = await selectPaymentMethod(serverAccepts, noBaseUSDC);

    const passed = selected !== null &&
      selected.asset === 'WETH' &&
      selected.protocol === 'permit2';
    results.push({
      testNumber: 'A3',
      name: 'Server prefers Base, Client lacks Base, has WETH',
      passed,
      expected: methodId(WETH),
      actual: methodId(selected),
    });

    if (passed) {
      console.log(`  ✅ A3: Server prefers Base, Client lacks Base, has WETH → ${methodId(selected)}`);
    } else {
      console.log(`  ❌ A3: Server prefers Base, Client lacks Base, has WETH`);
      console.log(`      Expected: ${methodId(WETH)}`);
      console.log(`      Actual:   ${methodId(selected)}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      testNumber: 'A3',
      name: 'Server prefers Base, Client lacks Base, has WETH',
      passed: false,
      expected: methodId(WETH),
      actual: 'error',
      error: errorMsg,
    });
    console.log(`  ❌ A3: Server prefers Base, Client lacks Base, has WETH`);
    console.log(`      Error: ${errorMsg}`);
  }

  // Test A4: Server accepts Base USDC, Solana USDC; Client has No Base USDC
  // Expected: Solana USDC (fallback to next in server order)
  try {
    const serverAccepts = [BASE_USDC, SOLANA_USDC];
    const selected = await selectPaymentMethod(serverAccepts, noBaseUSDC);

    const passed = selected !== null && selected.network.startsWith('solana:');
    results.push({
      testNumber: 'A4',
      name: 'Server prefers Base, Client lacks Base',
      passed,
      expected: methodId(SOLANA_USDC),
      actual: methodId(selected),
    });

    if (passed) {
      console.log(`  ✅ A4: Server prefers Base, Client lacks Base → ${methodId(selected)}`);
    } else {
      console.log(`  ❌ A4: Server prefers Base, Client lacks Base`);
      console.log(`      Expected: ${methodId(SOLANA_USDC)}`);
      console.log(`      Actual:   ${methodId(selected)}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      testNumber: 'A4',
      name: 'Server prefers Base, Client lacks Base',
      passed: false,
      expected: methodId(SOLANA_USDC),
      actual: 'error',
      error: errorMsg,
    });
    console.log(`  ❌ A4: Server prefers Base, Client lacks Base`);
    console.log(`      Error: ${errorMsg}`);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n📊 Test Summary - Group A: Server Preference');
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
