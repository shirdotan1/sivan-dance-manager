"use client";

import type { DanceProject, PrivateSpace, Session, Song } from "@/lib/types";
import { MediaSection } from "@/components/lesson/MediaSection";
import { NotesSection } from "@/components/lesson/NotesSection";
import { PaymentsSection } from "@/components/lesson/PaymentsSection";
import { SongsSection } from "@/components/lesson/SongsSection";

interface SessionEditorProps {
  space: PrivateSpace;
  project: DanceProject;
  session: Session;
  bank: Song[];
}

/**
 * Interactive project session view: payments, songs, notes and media.
 * All state is in memory only (demo): changes are lost on refresh.
 */
export function SessionEditor({ space, project, session, bank }: SessionEditorProps) {
  return (
    <>
      <PaymentsSection
        students={space.students}
        participantIds={project.participantIds}
        initial={session.payments}
      />
      <SongsSection bank={bank} initialSongIds={session.songIds} heading="שירים במפגש" addedTo="למפגש" />
      <NotesSection initial={session.notes} label="הערות למפגש" />
      <MediaSection initial={session.media} />
    </>
  );
}
