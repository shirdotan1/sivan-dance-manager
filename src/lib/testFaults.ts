import "server-only";
import { headers } from "next/headers";

/**
 * E2E fault injection, per request. A fault fires ONLY when all three hold:
 *   - the server was started with MEDIA_TEST_FAULTS=on (the e2e fault
 *     server; production never sets it),
 *   - the storage bucket is a test bucket (name contains "test"),
 *   - the request carries `x-test-fault: <name>[,<name>…]` naming it.
 * Lets tests prove that a failed write fails the action and is reported.
 */
export type TestFault = "deletePrefix" | "startMultipart" | "headAsHtml" | "mediaRowDelete" | "groupMembersDelete" | "renewal";

export async function testFault(name: TestFault): Promise<boolean> {
  if (process.env.MEDIA_TEST_FAULTS !== "on") return false;
  if (!/test/i.test(process.env.R2_BUCKET_NAME ?? "")) return false;
  const requested = (await headers()).get("x-test-fault") ?? "";
  return requested.split(",").map((s) => s.trim()).includes(name);
}
