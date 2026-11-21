import { cleanup, db } from "./support/env";

/** The test database goes back to its seed state after every run. */
export default async function globalTeardown() {
  console.log("cleanup after:", JSON.stringify(await cleanup(await db())));
}
