import { prerenderErrors } from "./support/serverLog";
import { expect, test } from "./support/fixtures";

/**
 * The full-run server-log guard (global teardown) fails the run on these
 * lines. Real lines from the server logs before the prerender fix.
 */
test.beforeEach(({}, info) => test.skip(info.project.name !== "phone-390", "no browser involved: once is enough"));

test("the server-log guard catches every prerender error Next logged, and nothing else", () => {
  const caught = [
    'Error: Route "/": Next.js encountered the unstable value `Date.now()` while prerendering.',
    '[WebServer] Error: Route "/calendar": Next.js encountered the unstable value `new Date()` while prerendering.',
    'series renewal failed Error: series: Error: During prerendering, fetch() rejects when the prerender is complete. Typically these errors are handled by React…',
  ];
  const ignored = [
    "series renewal failed Error: Injected test fault: renewal",
    "✓ Ready in 135ms",
    'series renewal skipped conflicting dates [{"date":"2026-12-02"}]',
  ];
  expect(prerenderErrors([...ignored, ...caught].join("\n"))).toEqual(caught);
  expect(prerenderErrors(ignored.join("\n"))).toEqual([]);
});
