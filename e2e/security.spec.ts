import fs from "node:fs";
import path from "node:path";
import { expect, test } from "./support/fixtures";

/** No storage secret, key id or account endpoint in anything sent to the browser. */
test("R2 credentials never appear in client bundles", async ({}, info) => {
  test.skip(info.project.name !== "phone-390", "build output is the same for both widths");
  const secrets = {
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
    R2_ENDPOINT_HOST: new URL(process.env.R2_ENDPOINT!).host,
  };
  for (const [name, value] of Object.entries(secrets)) expect(value, `${name} is set`).toBeTruthy();

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(".next/static");
  expect(files.length).toBeGreaterThan(10);
  // Positive control: text from a client component IS in the bundle, so the scan
  // must find it (proves it reads the real client code). Supabase is server-only here.
  expect(files.some((f) => fs.readFileSync(f, "utf8").includes("ניסיון חוזר")), "scan finds client text").toBe(true);
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    for (const [name, value] of Object.entries(secrets)) {
      expect(text.includes(value), `${name} found in ${f}`).toBe(false);
    }
  }
});
