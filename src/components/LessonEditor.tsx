"use client";

import { useState } from "react";
import type { Lesson, Song, StudioSpace } from "@/lib/types";
import { MediaSection } from "@/components/lesson/MediaSection";
import { NotesSection } from "@/components/lesson/NotesSection";
import { ParticipantsSection } from "@/components/lesson/ParticipantsSection";
import { SongsSection } from "@/components/lesson/SongsSection";

interface LessonEditorProps {
  space: StudioSpace;
  lesson: Lesson;
  bank: Song[];
}

/**
 * Interactive studio lesson view. All state is in memory only (demo):
 * changes are lost on refresh.
 */
export function LessonEditor({ space, lesson, bank }: LessonEditorProps) {
  const [participantIds, setParticipantIds] = useState(lesson.participantIds);

  return (
    <>
      <ParticipantsSection
        pool={space.students}
        groups={space.groups}
        participantIds={participantIds}
        onChange={setParticipantIds}
      />
      <SongsSection bank={bank} initialSongIds={lesson.songIds} heading="שירים בשיעור" addedTo="לשיעור" />
      <NotesSection initial={lesson.notes} label="הערות לשיעור" />
      <MediaSection initial={lesson.media} />
    </>
  );
}
