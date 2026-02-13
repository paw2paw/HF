import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Custom rules for design system consistency
  {
    rules: {
      // Catch hardcoded hex colors in inline styles - use CSS variables instead
      // e.g., background: "#fff" → background: "var(--surface-primary)"
      "no-restricted-syntax": [
        "warn",
        {
          selector: "JSXAttribute[name.name='style'] Property[key.name=/^(background|backgroundColor|color|borderColor|border)$/] Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "Avoid hardcoded hex colors in inline styles. Use CSS variables instead (e.g., var(--surface-primary), var(--text-primary)). See globals.css for available tokens.",
        },
      ],
    },
  },
  // Enforce config+metering for ALL AI calls (no raw client usage)
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/ai/client",
              importNames: [
                "getAICompletion",
                "getAICompletionStream",
                "getConfiguredAICompletion",
                "getConfiguredAICompletionStream",
              ],
              message:
                "Use getConfiguredMeteredAICompletion or getConfiguredMeteredAICompletionStream from @/lib/metering. All AI calls must have config + metering. See: /x/ai-config",
            },
            {
              name: "@/lib/metering",
              importNames: [
                "getMeteredAICompletion",
                "getMeteredAICompletionStream",
                "createMeteredStream",
              ],
              message:
                "Use getConfiguredMeteredAICompletion or getConfiguredMeteredAICompletionStream from @/lib/metering. These include config + metering in one call.",
            },
          ],
        },
      ],
    },
  },
  // Exempt AI wrapper modules (they ARE the wrappers)
  {
    files: ["lib/metering/**/*.ts", "lib/ai/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
