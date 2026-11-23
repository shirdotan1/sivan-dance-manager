import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TAG, db } from "./support/env";
import { expect, test } from "./support/fixtures";

/** scripts/restore-drill.mjs: restores and undoes exactly what it inserted — even after a mid-table failure. */
test.beforeEach(({}, info) => test.skip(info.project.name !== "phone-390", "no browser involved: once is enough"));

const SPACES = [{ id: "new-high-school" }, { id: "balance-studio" }, { id: "private-lessons" }];
const student = (n: number, spaceId = "private-lessons") => ({
  id: crypto.randomUUID(),
  space_id: spaceId,
  name: `${TAG} תרגיל ${n}`,
  phone: "",
  parent_name: "",
  parent_phone: "",
  archived_at: null,
  created_at: new Date().toISOString(),
});
function runDrill(doc: object) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "drill-")), "export.json");
  fs.writeFileSync(file, JSON.stringify(doc));
  return spawnSync("node", ["scripts/restore-drill.mjs", file], { env: process.env, encoding: "utf8" });
}
const remaining = async (ids: string[]) => (await (await db()).from("students").select("id").in("id", ids)).data!.length;

test("a failure in a later batch: the earlier batch is undone too, and the drill fails loudly", async () => {
  // 201 students: the first 200 are one batch and insert; the 201st (an unknown space) fails the second batch.
  const rows = [...Array.from({ length: 200 }, (_, i) => student(i)), student(200, "no-such-space")];
  const r = runDrill({ app: "sivan-dance-manager", format: 1, exportedAt: new Date().toISOString(), tables: { spaces: SPACES, students: rows } });
  expect(r.status).toBe(1);
  expect(r.stdout).toContain("failed at rows 201–201");
  expect(r.stdout).toContain("RESTORE DRILL: FAIL");
  expect(await remaining(rows.map((x) => x.id))).toBe(0); // the first batch did not leak
});

test("a valid export restores, verifies and undoes cleanly", async () => {
  const rows = [student(1), student(2)];
  const r = runDrill({ app: "sivan-dance-manager", format: 1, exportedAt: new Date().toISOString(), tables: { spaces: SPACES, students: rows } });
  expect(r.status, r.stdout + r.stderr).toBe(0);
  expect(r.stdout).toContain("RESTORE DRILL: PASS");
  expect(await remaining(rows.map((x) => x.id))).toBe(0);
});
