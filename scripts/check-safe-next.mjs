// Checks the post-login redirect validation (src/lib/safe-next.ts).
//   npm run check:safe-next
// Node ≥ 22.18 strips the TypeScript types from the imported .ts file.
import { safeNext } from "../src/lib/safe-next.ts";

const cases = [
  // Same-origin paths are kept.
  ["/songs", "/songs"],
  ["/calendar?month=2026-11&day=2026-11-16", "/calendar?month=2026-11&day=2026-11-16"],
  ["/spaces/new-high-school/lessons/abc#x", "/spaces/new-high-school/lessons/abc#x"],
  ["/%2F%2Fevil.com", "/%2F%2Fevil.com"], // encoded slashes stay a local path
  ["/a/../../b", "/b"],
  // Backslashes are rejected (browsers treat "\" as "/").
  ["/\\evil.com", "/"],
  ["\\\\evil.com", "/"],
  ["/songs\\..\\x", "/"],
  // External / protocol-relative targets are rejected, before or after normalization.
  ["//evil.com", "/"],
  ["//evil.com/songs", "/"],
  ["/..//evil.com", "/"],
  ["/./..//evil.com/x", "/"],
  ["https://evil.com", "/"],
  ["javascript:alert(1)", "/"],
  ["evil.com", "/"],
  // Junk falls back to home.
  ["/\tevil", "/"],
  ["", "/"],
  [null, "/"],
  [42, "/"],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = safeNext(input);
  if (got !== expected) {
    failed++;
    console.error(`✗ safeNext(${JSON.stringify(input)}) = ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  }
}
if (failed) {
  console.error(`${failed} of ${cases.length} cases failed`);
  process.exit(1);
}
console.log(`safeNext: all ${cases.length} cases pass`);
