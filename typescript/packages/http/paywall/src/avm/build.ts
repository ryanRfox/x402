import esbuild from "esbuild";
import { htmlPlugin } from "@craftamap/esbuild-plugin-html";
import fs from "fs";
import path from "path";
import { USDC_CONFIG } from "@x402/avm";
import { getBaseTemplate } from "../baseTemplate";
import { formatTypeScript, toPythonStringLiteral } from "../genHelpers";

// AVM-specific build - only bundles Algorand dependencies
const DIST_DIR = "src/avm/dist";
const OUTPUT_HTML = path.join(DIST_DIR, "avm-paywall.html");
const OUTPUT_TS = path.join("src/avm/gen", "template.ts");
const OUTPUT_FAUCETS = path.join("src/avm/gen", "faucetUrls.ts");

// Cross-language template output paths (relative to package root where build runs)
const PYTHON_DIR = path.join("..", "..", "..", "..", "python", "x402", "http", "paywall");
const GO_DIR = path.join("..", "..", "..", "..", "go", "http");
const OUTPUT_PY = path.join(PYTHON_DIR, "avm_paywall_template.py");
const OUTPUT_GO = path.join(GO_DIR, "avm_paywall_template.go");

const options: esbuild.BuildOptions = {
  entryPoints: ["src/avm/entry.tsx", "src/styles.css"],
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
          entryPoints: ["src/avm/entry.tsx", "src/styles.css"],
          filename: "avm-paywall.html",
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
  external: [
    "crypto",
    // Mark unused wallet providers as external - we only use Pera, Defly, Lute
    "@algorandfoundation/liquid-auth-use-wallet-client",
    "@perawallet/connect-beta",
    "@agoralabs-sh/avm-web-provider",
    "@walletconnect/sign-client",
    "@walletconnect/modal",
  ],
};

/**
 * Builds the AVM paywall HTML template with bundled JS and CSS.
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
    console.log("[AVM] Build completed successfully!");

    if (fs.existsSync(OUTPUT_HTML)) {
      const html = fs.readFileSync(OUTPUT_HTML, "utf8");

      const rawTsContent = `// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
/**
 * The pre-built AVM paywall template with inlined CSS and JS
 */
export const AVM_PAYWALL_TEMPLATE = ${JSON.stringify(html)};
`;
      const tsContent = await formatTypeScript(OUTPUT_TS, rawTsContent);

      // Generate Python template file
      const pyContent = `# THIS FILE IS AUTO-GENERATED - DO NOT EDIT
AVM_PAYWALL_TEMPLATE = ${toPythonStringLiteral(html)}
`;

      // Generate Go template file
      const goContent = `// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
package http

// AVMPaywallTemplate is the pre-built AVM paywall template with inlined CSS and JS
const AVMPaywallTemplate = ${JSON.stringify(html)}
`;

      fs.writeFileSync(OUTPUT_TS, tsContent);
      console.log(`[AVM] Generated template.ts (${(html.length / 1024 / 1024).toFixed(2)} MB)`);

      // Generate a faucet-URL lookup sourced from @x402/avm's USDC_CONFIG.
      // Only chains with a `faucetUrl` populated appear in the map; others
      // fall through to the paywall's hardcoded fallback or to a consumer
      // override on PaywallConfig.
      const avmFaucetEntries = Object.entries(USDC_CONFIG)
        .filter(([, info]) => typeof info.faucetUrl === "string" && info.faucetUrl.length > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([network, info]) => `  ${JSON.stringify(network)}: ${JSON.stringify(info.faucetUrl)},`,
        )
        .join("\n");
      const rawAvmFaucetsContent = `// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
// Source: @x402/avm USDC_CONFIG (faucetUrl only).
// Regenerate via: pnpm --filter @x402/paywall run build:paywall

/**
 * Per-network testnet faucet URLs for AVM, keyed by CAIP-2 network identifier.
 * Mirrors the \`faucetUrl\` field of \`USDC_CONFIG\` from \`@x402/avm\` and is
 * emitted at build time so the paywall's runtime module graph does not
 * depend on \`@x402/avm\`. Networks without a configured faucet URL are
 * absent — callers should fall back to the paywall's hardcoded default
 * (the Algorand testnet dispenser) or to a consumer-provided override on
 * \`PaywallConfig.faucetUrl\` / \`PaywallConfig.faucetUrls[caip2]\`.
 */
export const FAUCET_URLS: Record<string, string> = {
${avmFaucetEntries}
};
`;
      const avmFaucetsContent = await formatTypeScript(OUTPUT_FAUCETS, rawAvmFaucetsContent);
      fs.writeFileSync(OUTPUT_FAUCETS, avmFaucetsContent);
      console.log(
        `[AVM] Generated faucetUrls.ts (${avmFaucetEntries.split("\n").filter(l => l).length} networks)`,
      );

      // Write the Python template file
      if (fs.existsSync(PYTHON_DIR)) {
        fs.writeFileSync(OUTPUT_PY, pyContent);
        console.log(
          `[AVM] Generated Python avm_paywall_template.py (${(html.length / 1024 / 1024).toFixed(2)} MB)`,
        );
      } else {
        console.warn(`[AVM] Python directory not found: ${PYTHON_DIR}`);
      }

      // Write the Go template file
      if (fs.existsSync(GO_DIR)) {
        fs.writeFileSync(OUTPUT_GO, goContent);
        console.log(
          `[AVM] Generated Go avm_paywall_template.go (${(html.length / 1024 / 1024).toFixed(2)} MB)`,
        );
      } else {
        console.warn(`[AVM] Go directory not found: ${GO_DIR}`);
      }
    } else {
      throw new Error(`AVM bundled HTML not found at ${OUTPUT_HTML}`);
    }
  } catch (error) {
    console.error("[AVM] Build failed:", error);
    process.exit(1);
  }
}

build();
