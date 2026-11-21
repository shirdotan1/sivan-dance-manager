import { KindBadge, MaterialAction, MaterialArtist, MaterialTitle } from "@/components/materials/MaterialText";
import { StudentLink } from "@/components/StudentLink";
import type { Material, Student } from "@/lib/types";

/* Read-only sections shared by the lesson and session pages. */

export function ParticipantsView({ students, title = "משתתפות" }: { students: Student[]; title?: string }) {
  return (
    <section aria-labelledby="participants-heading" className="card card-section">
      <h2 id="participants-heading" className="mb-3">
        {title} ({students.length})
      </h2>
      {students.length === 0 ? (
        <p className="empty-state">אין משתתפות בשיעור הזה. אפשר להוסיף בעריכה.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" role="list">
          {students.map((s) => (
            <li key={s.id} className="chip">
              <StudentLink student={s} />
              {s.archived && <span className="text-muted"> (לא במאגר)</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MaterialsView({ materials, title }: { materials: Material[]; title: string }) {
  return (
    <section aria-labelledby="materials-heading" className="card card-section">
      <h2 id="materials-heading" className="mb-3">
        {title} ({materials.length})
      </h2>
      {materials.length === 0 ? (
        <p className="empty-state">לא נבחרו חומרים. אפשר להוסיף בעריכה.</p>
      ) : (
        <ul className="divider-list" role="list">
          {materials.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  <KindBadge material={m} />
                  <MaterialTitle material={m} />
                </span>
                {m.kind === "song" && (m.artist || m.style) && (
                  <span className="text-sm text-muted">
                    {m.artist && <MaterialArtist material={m} />}
                    {m.artist && m.style && " · "}
                    {m.style}
                  </span>
                )}
                {m.kind === "note" && m.note && (
                  <span className="block whitespace-pre-line text-sm" dir="auto">
                    {m.note}
                  </span>
                )}
              </span>
              <MaterialAction material={m} className="tap-link text-sm text-brand-strong underline underline-offset-4" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function NotesView({ notes }: { notes: string }) {
  return (
    <section aria-labelledby="notes-heading" className="card card-section">
      <h2 id="notes-heading" className="mb-3">
        הערות
      </h2>
      {notes ? (
        <p className="whitespace-pre-line" dir="auto">
          {notes}
        </p>
      ) : (
        <p className="empty-state">אין הערות. אפשר להוסיף בעריכה.</p>
      )}
    </section>
  );
}

