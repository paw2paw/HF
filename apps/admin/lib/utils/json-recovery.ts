/**
 * JSON Recovery Utility
 *
 * Recovers broken/truncated JSON from LLM output.
 * Merged superset of all pipeline recovery blocks — single source of truth.
 * NO HARDCODING — pure structural text recovery.
 */

export interface JsonRecoveryResult<T = any> {
  parsed: T;
  recovered: boolean;
  fixesApplied: string[];
}

/**
 * Attempt to parse JSON, applying progressive recovery steps if needed.
 *
 * Recovery steps (in order):
 * 1. Strip markdown code fences
 * 2. Fix unterminated fractional numbers (0. → 0.0)
 * 3. Remove incomplete trailing entries (odd-quote detection)
 * 4. Remove trailing commas before closing braces/brackets
 * 5. Fix incomplete key-value pairs at end
 * 6. Fix nested incomplete key-value pairs
 * 7. Add missing closing braces/brackets
 *
 * @param raw - Raw string content (potentially broken JSON)
 * @param context - Label for error logging (e.g. "pipeline:extract")
 * @returns Parsed result with recovery metadata
 * @throws If JSON is unrecoverable
 */
export function recoverBrokenJson<T = any>(
  raw: string,
  context?: string,
): JsonRecoveryResult<T> {
  const fixesApplied: string[] = [];
  let content = raw.trim();

  // Step 1: Strip markdown code fences
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    fixesApplied.push("stripped_code_fences");
  }

  // Step 2: Fix unterminated fractional numbers (e.g., "0." → "0.0")
  const fractionalFixed = content.replace(
    /(\d+\.)(?=\s*[,}\]]|$)/g,
    (_match, num) => num + "0",
  );
  if (fractionalFixed !== content) {
    fixesApplied.push("fixed_fractional_numbers");
    content = fractionalFixed;
  }

  // Try parsing before recovery
  try {
    return { parsed: JSON.parse(content) as T, recovered: fixesApplied.length > 0, fixesApplied };
  } catch {
    // Continue to recovery steps
  }

  // Step 2b: Replace single-quoted keys/values with double-quoted (LLM sometimes uses JS-style)
  const singleQuoteFixed = content
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'\s*:/g, '"$1":')   // 'key': → "key":
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"');  // : 'val' → : "val"
  if (singleQuoteFixed !== content) {
    fixesApplied.push("replaced_single_quotes");
    content = singleQuoteFixed;
    // Try parsing after single-quote fix
    try {
      return { parsed: JSON.parse(content) as T, recovered: true, fixesApplied };
    } catch {
      // Continue to more recovery steps
    }
  }

  // Step 2c: Strip JS-style comments (// and /* */) that LLMs sometimes add
  const commentStripped = content
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  if (commentStripped !== content) {
    fixesApplied.push("stripped_comments");
    content = commentStripped;
    try {
      return { parsed: JSON.parse(content) as T, recovered: true, fixesApplied };
    } catch {
      // Continue to more recovery steps
    }
  }

  let fixed = content;

  // Step 3: Odd-quote check — detect unterminated strings
  const quoteCount = (fixed.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    fixed = fixed.replace(/,\s*[^,]*$/g, "");
    fixesApplied.push("removed_incomplete_trailing_entry");
  }

  // Step 4: Remove trailing commas before closing braces/brackets
  const trailingFixed = fixed.replace(/,(\s*[}\]])/g, "$1");
  if (trailingFixed !== fixed) {
    fixesApplied.push("removed_trailing_commas");
    fixed = trailingFixed;
  }

  // Step 5: Fix incomplete key-value pairs at end (e.g., {"key": → {"key": 0.5})
  const kvFixed = fixed.replace(/["']([^"']+)["']\s*:\s*$/g, '"$1": 0.5');
  if (kvFixed !== fixed) {
    fixesApplied.push("fixed_incomplete_key_value");
    fixed = kvFixed;
  }

  // Step 6: Fix nested incomplete key-value (e.g., "key": { "sub" → "key": {"sub": 0.5})
  const nestedFixed = fixed.replace(
    /["']([^"']+)["']\s*:\s*\{\s*["']([^"']+)["']\s*$/g,
    '"$1": {"$2": 0.5',
  );
  if (nestedFixed !== fixed) {
    fixesApplied.push("fixed_nested_incomplete");
    fixed = nestedFixed;
  }

  // Step 7: Count and add missing closing characters
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;

  const missingBrackets = openBrackets - closeBrackets;
  const missingBraces = openBraces - closeBraces;

  if (missingBrackets > 0 || missingBraces > 0) {
    for (let i = 0; i < missingBrackets; i++) fixed += "]";
    for (let i = 0; i < missingBraces; i++) fixed += "}";
    fixesApplied.push("added_missing_closers");
  }

  // Final parse attempt
  try {
    return { parsed: JSON.parse(fixed) as T, recovered: true, fixesApplied };
  } catch (err: any) {
    if (context) {
      console.error(`[json-recovery] ${context}: recovery failed`, {
        originalLength: content.length,
        fixedLength: fixed.length,
        fixesApplied,
        lastChars: fixed.slice(-200),
        error: err.message,
      });
    }
    throw err;
  }
}
