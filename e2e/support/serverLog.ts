import fs from "node:fs";

/**
 * The app servers' output (playwright.config.ts tees it here). Global setup
 * records where this run starts in each log; global teardown fails the run
 * if a prerender error appeared after that point.
 */
export const SERVER_LOGS = ["e2e/.state/server-3100.log", "e2e/.state/server-3101.log"];
const OFFSETS = "e2e/.state/server-log-offsets.json";

/** Errors Next logs when a render that is not a request reads the clock or fetches. */
const PRERENDER_ERROR = /encountered the unstable value|rejects when the prerender is complete/;

const sizeOf = (file: string) => (fs.existsSync(file) ? fs.statSync(file).size : 0);

export function markServerLogs() {
  fs.mkdirSync("e2e/.state", { recursive: true });
  fs.writeFileSync(OFFSETS, JSON.stringify(Object.fromEntries(SERVER_LOGS.map((f) => [f, sizeOf(f)]))));
}

export function checkServerLogs() {
  let offsets: Record<string, number> = {};
  try {
    offsets = JSON.parse(fs.readFileSync(OFFSETS, "utf8"));
  } catch {
    /* no mark: check each log from its start */
  }
  const found: string[] = [];
  for (const file of SERVER_LOGS) {
    if (!fs.existsSync(file)) {
      console.warn(`SERVER LOG CHECK NOT RUN for ${file}: no log (a server started outside the suite was reused).`);
      continue;
    }
    const lines = fs.readFileSync(file).subarray(offsets[file] ?? 0).toString("utf8").split("\n");
    found.push(...lines.filter((l) => PRERENDER_ERROR.test(l)).map((l) => `${file}: ${l.trim()}`));
  }
  if (found.length) {
    throw new Error(`Prerender errors in the server logs (${found.length}):\n${[...new Set(found)].slice(0, 10).join("\n")}`);
  }
  console.log("server logs: no prerender errors");
}
