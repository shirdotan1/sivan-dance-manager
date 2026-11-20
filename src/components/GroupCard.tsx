"use client";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GroupForm } from "@/components/GroupForm";
import { StudentLink } from "@/components/StudentLink";
import { deleteGroup, updateGroup } from "@/lib/actions/groups";
import type { Group, Student } from "@/lib/types";

/** A studio group: color + name + members, with edit and delete. */
export function GroupCard({ group, pool, members }: { group: Group; pool: Student[]; members: Student[] }) {
  return (
    <li className="card">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-full" style={{ background: group.color }} />
          {group.name}
        </h3>
        <ConfirmDialog
          triggerLabel="מחיקה"
          triggerContext={`של הקבוצה ${group.name}`}
          title={`למחוק את הקבוצה ״${group.name}״?`}
          description={<p>התלמידות נשארות במאגר, והשיעורים של הקבוצה נשמרים (בלי שיוך לקבוצה).</p>}
          confirmLabel="מחיקת הקבוצה"
          onConfirm={() => deleteGroup(group.id)}
        />
      </div>
      <p className="mb-2 text-sm text-muted">{members.length} תלמידות</p>
      {members.length === 0 ? (
        <p className="text-sm text-muted">אין עדיין חברות בקבוצה.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" role="list">
          {members.map((m) => (
            <li key={m.id} className="chip">
              <StudentLink student={m} />
            </li>
          ))}
        </ul>
      )}
      <details className="disclosure mt-4">
        <summary>
          עריכה<span className="visually-hidden"> של הקבוצה {group.name}</span>
        </summary>
        <GroupForm action={updateGroup.bind(null, group.id)} pool={pool} group={group} submitLabel="שמירת הקבוצה" />
      </details>
    </li>
  );
}
