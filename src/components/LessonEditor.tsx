"use client";

import { useId, useState } from "react";
import { listenUrl, type Lesson, type Song, type StudioSpace } from "@/data/demo";
import { SongArtist, SongTitle } from "@/components/SongText";
import { MediaSection } from "@/components/lesson/MediaSection";
import { NotesSection } from "@/components/lesson/NotesSection";
import { ParticipantsSection } from "@/components/lesson/ParticipantsSection";
import { sectionClass } from "@/components/lesson/styles";

interface LessonEditorProps {
  space: StudioSpace;
  lesson: Lesson;
  lessonSongs: Song[];
}

/**
 * Interactive studio lesson view. All state is in memory only (demo):
 * changes are lost on refresh.
 */
export function LessonEditor({ space, lesson, lessonSongs }: LessonEditorProps) {
  const [participantIds, setParticipantIds] = useState(lesson.participantIds);

  return (
    <>
      <ParticipantsSection
        pool={space.students}
        groups={space.groups}
        participantIds={participantIds}
        onChange={setParticipantIds}
      />
      <SongsSection songs={lessonSongs} />
      <NotesSection initial={lesson.notes} label="הערות לשיעור" />
      <MediaSection initial={lesson.media} />
    </>
  );
}

function SongsSection({ songs }: { songs: Song[] }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={sectionClass}>
      <h2 id={headingId} className="mb-3 text-xl font-semibold">
        שירים בשיעור
      </h2>
      {songs.length === 0 ? (
        <p className="text-muted">לא נבחרו שירים לשיעור הזה.</p>
      ) : (
        <ul className="divide-y divide-border" role="list">
          {songs.map((song) => (
            <li key={song.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="block font-medium">
                  <SongTitle song={song} />
                </span>
                <span className="text-sm text-muted">
                  <SongArtist song={song} /> · {song.style}
                </span>
              </span>
              <a
                href={listenUrl(song)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-strong underline underline-offset-4"
              >
                האזנה
                <span className="visually-hidden">
                  {" "}
                  ל־<SongTitle song={song} /> (נפתח בלשונית חדשה)
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
