import { cleanup, db } from "./support/env";
import { checkServerLogs } from "./support/serverLog";

/** The test database goes back to its seed state after every run; then the server logs are checked. */
export default async function globalTeardown() {
  console.log("cleanup after:", JSON.stringify(await cleanup(await db())));
  checkServerLogs();
}
