import { SongArtist, SongTitle } from "@/components/SongText";
import { StudentLink } from "@/components/StudentLink";
import { listenUrl } from "@/lib/format";
import type { MediaItem, Song, Student } from "@/lib/types";

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

export function SongsView({ songs, title }: { songs: Song[]; title: string }) {
  return (
    <section aria-labelledby="songs-heading" className="card card-section">
      <h2 id="songs-heading" className="mb-3">
        {title} ({songs.length})
      </h2>
      {songs.length === 0 ? (
        <p className="empty-state">לא נבחרו שירים. אפשר להוסיף בעריכה.</p>
      ) : (
        <ul className="divider-list" role="list">
          {songs.map((song) => (
            <li key={song.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  <SongTitle song={song} />
                </span>
                {(song.artist || song.style) && (
                  <span className="text-sm text-muted">
                    {song.artist && <SongArtist song={song} />}
                    {song.artist && song.style && " · "}
                    {song.style}
                  </span>
                )}
              </span>
              <a
                href={listenUrl(song)}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-link text-sm text-brand-strong underline underline-offset-4"
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

const tints = ["bg-brand-soft", "bg-success-soft", "bg-danger-soft"];

export function MediaView({ media }: { media: MediaItem[] }) {
  return (
    <section aria-labelledby="media-heading" className="card card-section">
      <h2 id="media-heading" className="mb-3">
        מדיה ({media.length})
      </h2>
      {media.length === 0 ? (
        <p className="empty-state">אין עדיין תמונות או סרטונים.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="list">
          {media.map((item, i) => (
            <li key={item.id}>
              <figure>
                <div className={`flex aspect-square items-center justify-center rounded-lg text-4xl ${tints[i % tints.length]}`}>
                  <span aria-hidden="true">{item.kind === "video" ? "🎬" : "📷"}</span>
                </div>
                <figcaption className="mt-1 text-sm">
                  <span className="visually-hidden">{item.kind === "video" ? "סרטון: " : "תמונה: "}</span>
                  {item.caption}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-muted">אלה מצייני מקום — העלאת קבצים אמיתית תתווסף בשלב הבא.</p>
    </section>
  );
}
