import esbuild from "esbuild";
import { htmlPlugin } from "@craftamap/esbuild-plugin-html";
import fs from "fs";
import path from "path";
import { SOLANA_DEVNET_CAIP2, SOLANA_TESTNET_CAIP2 } from "@x402/svm";
import { getBaseTemplate } from "../baseTemplate";
import { formatTypeScript, toPythonStringLiteral } from "../genHelpers";

// SVM-specific build - only bundles Solana dependencies
const DIST_DIR = "src/svm/dist";
const OUTPUT_HTML = path.join(DIST_DIR, "svm-paywall.html");
const OUTPUT_TS = path.join("src/svm/gen", "template.ts");
const OUTPUT_FAUCETS = path.join("src/svm/gen", "faucetUrls.ts");

/**
 * Per-CAIP-2 testnet faucet URLs for Solana networks.
 *
 * Solana mechanism does not expose a `DEFAULT_STABLECOINS`-equivalent
 * structure (its `mechanisms/svm/src/constants.ts` lists per-network mints
 * as flat string constants). Faucet URLs are sourced inline from this
 * map, regenerated to `src/svm/gen/faucetUrls.ts` so the paywall bundle
 * has a runtime-dep-free lookup. Mainnet is intentionally absent — the
 * paywall faucet UI is testnet-gated.
 */
const SVM_FAUCET_URLS: Record<string, string> = {
  [SOLANA_DEVNET_CAIP2]: "https://faucet.circle.com/",
  [SOLANA_TESTNET_CAIP2]: "https://faucet.circle.com/",
};

// Cross-language template output paths (relative to package root where build runs)
const PYTHON_DIR = path.join("..", "..", "..", "..", "python", "x402", "http", "paywall");
const GO_DIR = path.join("..", "..", "..", "..", "go", "http");
const OUTPUT_PY = path.join(PYTHON_DIR, "svm_paywall_template.py");
const OUTPUT_GO = path.join(GO_DIR, "svm_paywall_template.go");

const options: esbuild.BuildOptions = {
  entryPoints: ["src/svm/entry.tsx", "src/styles.css"],
  bundle: true,
  metafile: true,
  outdir: DIST_DIR,
  treeShaking: true,
  minify: true,
  format: "iife",
  sourcemap: false,
  platform: "browser",
  target: "es2020",
  jsx: "transform",
  define: {
    "process.env.NODE_ENV": '"development"',
    global: "globalThis",
    Buffer: "globalThis.Buffer",
  },
  mainFields: ["browser", "module", "main"],
  conditions: ["browser"],
  plugins: [
    htmlPlugin({
      files: [
        {
          entryPoints: ["src/svm/entry.tsx", "src/styles.css"],
          filename: "svm-paywall.html",
          title: "Payment Required",
          scriptLoading: "module",
          inline: {
            css: true,
            js: true,
          },
          htmlTemplate: getBaseTemplate(),
        },
      ],
    }),
  ],
  inject: ["./src/buffer-polyfill.ts"],
  external: ["crypto"],
};

/**
 * Builds the SVM paywall HTML template with bundled JS and CSS.
 * Also generates Python and Go template files for cross-language support.
 */
async function build() {
  try {
    if (!fs.existsSync(DIST_DIR)) {
      fs.mkdirSync(DIST_DIR, { recursive: true });
    }

    const genDir = path.dirname(OUTPUT_TS);
    if (!fs.existsSync(genDir)) {
      fs.mkdirSync(genDir, { recursive: true });
    }

    await esbuild.build(options);
    console.log("[SVM] Build completed successfully!");

    if (fs.existsSync(OUTPUT_HTML)) {
      const html = fs.readFileSync(OUTPUT_HTML, "utf8");

      const rawTsContent = `// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
/**
 * The pre-built SVM paywall template with inlined CSS and JS
 */
export const SVM_PAYWALL_TEMPLATE = ${JSON.stringify(html)};
`;
      const tsContent = await formatTypeScript(OUTPUT_TS, rawTsContent);

      // Generate Python template file
      const pyContent = `# THIS FILE IS AUTO-GENERATED - DO NOT EDIT
SVM_PAYWALL_TEMPLATE = ${toPythonStringLiteral(html)}
`;

      // Generate Go template file
      const goContent = `// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
package http

// SVMPaywallTemplate is the pre-built SVM paywall template with inlined CSS and JS
const SVMPaywallTemplate = ${JSON.stringify(html)}
`;

      fs.writeFileSync(OUTPUT_TS, tsContent);
      console.log(`[SVM] Generated template.ts (${(html.length / 1024 / 1024).toFixed(2)} MB)`);

      // Generate the SVM faucet-URL lookup. Sourced from the inline
      // `SVM_FAUCET_URLS` map above (Solana mechanism has no `DEFAULT_STABLECOINS`
      // analogue, so the registry data lives here in the build script). Mirrors
      // the EVM regen contract — emitted at build time so the bundle is
      // runtime-dep-free.
      const svmFaucetEntries = Object.entries(SVM_FAUCET_URLS)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([network, url]) => `  ${JSON.stringify(network)}: ${JSON.stringify(url)},`)
        .join("\n");
      const rawSvmFaucetsContent = `// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
// Source: \`SVM_FAUCET_URLS\` inline map in \`src/svm/build.ts\`.
// Regenerate via: pnpm --filter @x402/paywall run build:paywall

/**
 * Per-network testnet faucet URLs for Solana, keyed by CAIP-2 network
 * identifier. Solana mechanism has no \`DEFAULT_STABLECOINS\` parallel,
 * so this map is curated inline in \`src/svm/build.ts\` rather than
 * sourced from \`@x402/svm\`. Networks without a configured faucet URL
 * are absent — callers should fall back to the paywall's hardcoded
 * default (\`https://faucet.circle.com/\`) or to a consumer-provided
 * override on \`PaywallConfig.faucetUrl\` / \`PaywallConfig.faucetUrls[caip2]\`.
 */
export const FAUCET_URLS: Record<string, string> = {
${svmFaucetEntries}
};
`;
      const svmFaucetsContent = await formatTypeScript(OUTPUT_FAUCETS, rawSvmFaucetsContent);
      fs.writeFileSync(OUTPUT_FAUCETS, svmFaucetsContent);
      console.log(
        `[SVM] Generated faucetUrls.ts (${Object.keys(SVM_FAUCET_URLS).length} networks)`,
      );

      // Write the Python template file
      if (fs.existsSync(PYTHON_DIR)) {
        fs.writeFileSync(OUTPUT_PY, pyContent);
        console.log(
          `[SVM] Generated Python svm_paywall_template.py (${(html.length / 1024 / 1024).toFixed(2)} MB)`,
        );
      } else {
        console.warn(`[SVM] Python directory not found: ${PYTHON_DIR}`);
      }

      // Write the Go template file
      if (fs.existsSync(GO_DIR)) {
        fs.writeFileSync(OUTPUT_GO, goContent);
        console.log(
          `[SVM] Generated Go svm_paywall_template.go (${(html.length / 1024 / 1024).toFixed(2)} MB)`,
        );
      } else {
        console.warn(`[SVM] Go directory not found: ${GO_DIR}`);
      }
    } else {
      throw new Error(`SVM bundled HTML not found at ${OUTPUT_HTML}`);
    }
  } catch (error) {
    console.error("[SVM] Build failed:", error);
    process.exit(1);
  }
}

build();
