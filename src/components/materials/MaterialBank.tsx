"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MaterialForm } from "@/components/materials/MaterialForm";
import { KindBadge, MaterialAction, MaterialArtist, MaterialTitle } from "@/components/materials/MaterialText";
import { createMaterial, deleteMaterial, updateMaterial } from "@/lib/actions/materials";
import type { MaterialUse } from "@/lib/data/queries";
import { MATERIAL_KINDS, formatShortDate, materialKindLabel } from "@/lib/format";
import type { Material, MaterialKind } from "@/lib/types";

type Filter = "all" | MaterialKind;

/** The materials bank: add, filter by kind (all by default), search, edit, delete. */
export function MaterialBank({ materials, usage }: { materials: Material[]; usage: Record<string, MaterialUse[]> }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = MATERIAL_KINDS.reduce((m, k) => ({ ...m, [k]: materials.filter((x) => x.kind === k).length }), {} as Record<MaterialKind, number>);
  const q = query.trim().toLowerCase();
  const visible = materials.filter(
    (m) =>
      (filter === "all" || m.kind === filter) &&
      (!q || [m.title, m.artist, m.style, m.note ?? "", m.link ?? ""].some((f) => f.toLowerCase().includes(q))),
  );

  return (
    <>
      <details className="disclosure mb-8">
        <summary>+ הוספת חומר לבנק</summary>
        <MaterialForm action={createMaterial} submitLabel="הוספה לבנק" label="הוספת חומר לבנק" />
      </details>

      <search className="mb-4 grid gap-3">
        <fieldset>
          <legend className="mb-1 font-medium">הצגה לפי סוג</legend>
          <div className="flex flex-wrap gap-2">
            {(["all", ...MATERIAL_KINDS] as Filter[]).map((f) => (
              <label key={f} htmlFor={`${id}-f-${f}`} className="filter-chip">
                <input
                  type="radio"
                  id={`${id}-f-${f}`}
                  name={`${id}-filter`}
                  value={f}
                  checked={filter === f}
                  onChange={() => setFilter(f)}
                />
                {f === "all" ? "הכול" : materialKindLabel[f]}{" "}
                <span className="text-muted">({f === "all" ? materials.length : counts[f]})</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-q`} className="font-medium">
            חיפוש לפי שם, מבצע/ת, סגנון, הערה או לינק
          </label>
          <input
            id={`${id}-q`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            dir="auto"
          />
        </div>
      </search>

      <p role="status" className="mb-3 text-sm text-muted">
        {visible.length === materials.length ? `${materials.length} חומרים בבנק` : `מוצגים ${visible.length} מתוך ${materials.length} חומרים`}
      </p>

      {visible.length === 0 ? (
        <p className="empty-state">
          {q ? (
            <>
              לא נמצאו חומרים עבור ״<bdi>{query.trim()}</bdi>״. אפשר לנסות מילה אחרת, או להוסיף חומר בטופס שלמעלה.
            </>
          ) : (
            "אין עדיין חומרים מהסוג הזה. אפשר להוסיף בטופס שלמעלה."
          )}
        </p>
      ) : (
        <ul className="grid gap-4" role="list">
          {visible.map((m) => (
            <li key={m.id} className="card flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="mb-1">
                  <KindBadge material={m} />
                </p>
                <h2>
                  <MaterialTitle material={m} />
                </h2>
                {m.kind === "song" ? (
                  <>
                    {m.artist && (
                      <p className="text-muted">
                        <MaterialArtist material={m} />
                      </p>
                    )}
                    {m.style && <p className="mt-1 text-sm text-muted">{m.style}</p>}
                  </>
                ) : (
                  m.link && (
                    <p className="mt-1 truncate text-sm text-muted" dir="ltr">
                      {m.link}
                    </p>
                  )
                )}
                {m.note && (
                  <p className={`mt-3 border-s-2 border-coral ps-3 text-sm ${m.kind === "note" ? "whitespace-pre-line" : ""}`}>
                    <span className="visually-hidden">{m.kind === "note" ? "תוכן: " : "הערה: "}</span>
                    <bdi>{m.note}</bdi>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MaterialAction material={m} className="btn btn-secondary btn-compact" />
                <ConfirmDialog
                  triggerLabel="מחיקה"
                  triggerContext={`של ${m.title}`}
                  title={`למחוק את ״${m.title}״ מהבנק?`}
                  description={<p>החומר יוסר גם מכל השיעורים והמפגשים שבהם הוא מופיע.</p>}
                  confirmLabel="מחיקה מהבנק"
                  onConfirm={() => deleteMaterial(m.id)}
                />
              </div>
              <MaterialUsage uses={usage[m.id] ?? []} title={m.title} />
              <details className="disclosure basis-full">
                <summary>
                  עריכה<span className="visually-hidden"> של {m.title}</span>
                </summary>
                <MaterialForm action={updateMaterial.bind(null, m.id)} material={m} submitLabel="שמירה" label={`עריכת ${m.title}`} />
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** "Used in N lessons and M sessions", expandable to links. */
function MaterialUsage({ uses, title }: { uses: MaterialUse[]; title: string }) {
  const lessons = uses.filter((u) => u.kind === "lesson").length;
  const sessions = uses.length - lessons;
  if (uses.length === 0) return <p className="basis-full text-sm text-muted">עדיין לא שימש בשיעורים או במפגשים.</p>;
  const parts = [
    lessons ? (lessons === 1 ? "שיעור אחד" : `${lessons} שיעורים`) : "",
    sessions ? (sessions === 1 ? "מפגש אחד" : `${sessions} מפגשים`) : "",
  ].filter(Boolean);
  return (
    <details className="disclosure basis-full">
      <summary>
        שימוש: {parts.join(" ו־")}
        <span className="visually-hidden"> — {title}</span>
      </summary>
      <ul className="grid gap-1 px-4 pb-3" role="list">
        {uses.map((u) => (
          <li key={u.href}>
            <Link href={u.href} className="tap-link text-brand-strong underline underline-offset-4">
              {u.kind === "lesson" ? "שיעור" : "מפגש"} {formatShortDate(u.date)} · {u.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
