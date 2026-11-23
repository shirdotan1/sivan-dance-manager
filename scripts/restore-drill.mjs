#!/usr/bin/env node
/**
 * Restore drill: proves a JSON export from the live site can be restored.
 *
 *   node --env-file=.env.local scripts/restore-drill.mjs <export.json>
 *
 * Runs ONLY against the Supabase TEST project (refuses anything else), signed
 * in as the e2e test user. Non-destructive: it inserts the export's rows by
 * their own ids, verifies per table that every exported row arrived, then
 * deletes exactly those ids again (reverse order) and verifies none remain —
 * the test project ends as it started. Spaces are structure (same fixed ids
 * in every project): compared, never inserted. Media FILES are not in the
 * export (rows only), so this restores data, not photos/videos.
 *
 * Exit code 0 only if every step matched.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_PROJECT_REF = "gapprimwuxufzdjcnwwm";
const file = process.argv[2];
if (!file) {
  console.error("usage: node --env-file=.env.local scripts/restore-drill.mjs <export.json>");
  process.exit(2);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes(TEST_PROJECT_REF) || (process.env.PROD_SUPABASE_URL && url === process.env.PROD_SUPABASE_URL)) {
  console.error("REFUSED: the target is not the Supabase test project.");
  process.exit(2);
}

// Dependency order (parents first). Composite keys for link tables.
const ORDER = [
  "students", "groups", "group_members", "songs", "lesson_series", "lessons", "lesson_participants",
  "lesson_songs", "projects", "project_participants", "sessions", "session_payments", "session_songs", "media_items",
];
const PK = {
  group_members: ["group_id", "student_id"], lesson_participants: ["lesson_id", "student_id"],
  lesson_songs: ["lesson_id", "song_id"], project_participants: ["project_id", "student_id"],
  session_payments: ["session_id", "student_id"], session_songs: ["session_id", "song_id"],
};
const keyOf = (t, r) => (PK[t] ? PK[t].map((c) => r[c]).join("|") : r.id);

const doc = JSON.parse(fs.readFileSync(file, "utf8"));
const tables = doc.tables ?? {};
const sb = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: loginError } = await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD });
if (loginError) {
  console.error("login failed:", loginError.message);
  process.exit(1);
}

/** Rows of `t` whose keys are among `keys` (read back from the database). */
async function present(t, rows) {
  if (!rows.length) return new Set();
  const first = PK[t] ? PK[t][0] : "id";
  const ids = [...new Set(rows.map((r) => r[first]))];
  const found = new Set();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from(t).select(PK[t] ? PK[t].join(",") : "id").in(first, ids.slice(i, i + 200));
    if (error) throw new Error(`${t} read: ${error.message}`);
    for (const r of data) found.add(keyOf(t, r));
  }
  const wanted = new Set(rows.map((r) => keyOf(t, r)));
  return new Set([...found].filter((k) => wanted.has(k)));
}

const report = [];
let ok = true;
const note = (table, step, result, pass) => {
  report.push({ table, step, result, pass: pass ? "✓" : "✗" });
  if (!pass) ok = false;
};

console.log(`export: ${file} | app ${doc.app ?? "?"} | format ${doc.format ?? "?"} | exported ${doc.exportedAt ?? "?"}`);

// Spaces: compared, not inserted.
{
  const exported = tables.spaces ?? [];
  const { data, error } = await sb.from("spaces").select("id");
  const have = new Set((data ?? []).map((s) => s.id));
  const missing = exported.filter((s) => !have.has(s.id)).map((s) => s.id);
  note("spaces", "compare", error ? error.message : missing.length ? `missing in test: ${missing.join(", ")}` : `${exported.length}/${exported.length} exist`, !error && !missing.length);
}

/** Every batch that was actually inserted (table + its rows) — undone exactly, even after a mid-table failure. */
const inserted = [];
try {
  // Collisions first: restoring must not overwrite anything.
  for (const t of ORDER) {
    const rows = tables[t] ?? [];
    const clash = await present(t, rows);
    if (clash.size) {
      note(t, "collision check", `${clash.size} exported ids already exist in the test project — not restoring`, false);
      throw new Error("collision");
    }
  }
  for (const t of ORDER) {
    const rows = tables[t];
    if (!rows) {
      note(t, "insert", "not in this export (older format) — skipped", true);
      continue;
    }
    if (!rows.length) {
      note(t, "insert", "0 rows", true);
      continue;
    }
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await sb.from(t).insert(batch);
      if (error) {
        note(t, "insert", `failed at rows ${i + 1}–${i + batch.length}: ${error.message}`, false);
        throw new Error(`insert ${t}`);
      }
      inserted.push({ table: t, rows: batch }); // recorded the moment it exists
    }
    const got = await present(t, rows);
    note(t, "insert + verify", `${got.size}/${rows.length} rows present`, got.size === rows.length);
  }
} catch (e) {
  if (!["collision"].includes(e.message)) note("—", "restore", `stopped: ${e.message}`, false);
} finally {
  // Undo: delete exactly the inserted batches, last first (children before
  // parents), then verify per table that none of them is left.
  for (const { table: t, rows } of [...inserted].reverse()) {
    // Single-key tables: one delete per batch of ids; link tables (composite key): row by row.
    const deletes = PK[t]
      ? rows.map((r) => PK[t].reduce((q, c) => q.eq(c, r[c]), sb.from(t).delete()))
      : [sb.from(t).delete().in("id", rows.map((r) => r.id))];
    for (const q of deletes) {
      const { error } = await q;
      if (error) {
        note(t, "undo", `delete failed: ${error.message}`, false);
        break;
      }
    }
  }
  for (const t of [...new Set(inserted.map((b) => b.table))].reverse()) {
    const rows = inserted.filter((b) => b.table === t).flatMap((b) => b.rows);
    const left = await present(t, rows);
    note(t, "undo + verify", `${left.size} of ${rows.length} restored rows left`, left.size === 0);
  }
}

console.table(report);
console.log(ok ? "RESTORE DRILL: PASS — every exported row restored and verified; test project back to its start." : "RESTORE DRILL: FAIL — see ✗ rows above.");
process.exit(ok ? 0 : 1);
