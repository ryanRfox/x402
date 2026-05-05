import { formatUnits } from "viem";

/**
 * Prints a banner for the start of a phase.
 *
 * @param phaseNumber - One-based phase index.
 * @param name - Short label for the phase.
 */
export function phaseHeader(phaseNumber: number, name: string): void {
  const bar = "=".repeat(72);
  console.log(`\n${bar}`);
  console.log(`=== PHASE ${phaseNumber}: ${name} ===`);
  console.log(`${bar}\n`);
}

/**
 * Sleeps for a specified number of milliseconds.
 *
 * @param ms - Delay in milliseconds.
 * @returns Promise that resolves after the delay.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Formats a USDC base-unit amount as a human readable dollar string.
 *
 * @param amount - Token amount in USDC base units (6 decimals).
 * @returns Formatted string like `$0.012345 (12345 base units)`.
 */
export function fmtUsdc(amount: bigint | string | undefined): string {
  if (amount === undefined) return "—";
  const n = typeof amount === "bigint" ? amount : BigInt(amount);
  return `$${formatUnits(n, 6)} (${n} base units)`;
}

/**
 * Logs an invariant assertion outcome and throws on failure.
 *
 * @param label - Name of the invariant.
 * @param condition - Result of the predicate.
 * @param details - Optional supporting context displayed regardless of pass/fail.
 */
export function assertInvariant(label: string, condition: boolean, details?: string): void {
  const status = condition ? "OK" : "FAIL";
  const line = details ? `  [${status}] ${label} — ${details}` : `  [${status}] ${label}`;
  console.log(line);
  if (!condition) {
    throw new Error(`Invariant failed: ${label}${details ? ` — ${details}` : ""}`);
  }
}

/**
 * Result row collected by each phase for the final summary.
 */
export interface PhaseResult {
  /** Phase number, 1-based. */
  phase: number;
  /** Short phase label. */
  name: string;
  /** Description of what this phase aimed to demonstrate. */
  expected: string;
  /** What actually happened. */
  actual: string;
  /** Whether the phase succeeded. */
  passed: boolean;
}

/**
 * Prints a final summary table of all phase results.
 *
 * @param results - Phase results to render.
 */
export function printSummary(results: PhaseResult[]): void {
  const bar = "=".repeat(72);
  console.log(`\n${bar}`);
  console.log("=== SUMMARY ===");
  console.log(`${bar}\n`);
  for (const r of results) {
    const mark = r.passed ? "PASS" : "FAIL";
    console.log(`[${mark}] PHASE ${r.phase}: ${r.name}`);
    console.log(`       expected: ${r.expected}`);
    console.log(`       actual:   ${r.actual}`);
  }
  const failed = results.filter(r => !r.passed).length;
  console.log(`\n${results.length - failed}/${results.length} phases passed.`);
}

/**
 * Prints a single labeled key/value diff line indented for state-diff blocks.
 *
 * @param label - Field label.
 * @param before - Pre-state value.
 * @param after - Post-state value.
 */
export function printDiff(label: string, before: string, after: string): void {
  if (before === after) {
    console.log(`  ${label.padEnd(28)} ${before}`);
  } else {
    console.log(`  ${label.padEnd(28)} ${before}  ->  ${after}`);
  }
}
