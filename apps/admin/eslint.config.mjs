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
]);

export default eslintConfig;
