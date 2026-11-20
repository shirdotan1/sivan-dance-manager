import type { Metadata } from "next";
import { Suspense } from "react";
import { SongBank } from "@/components/SongBank";
import { getSongUsage, getSongs } from "@/lib/data/queries";

export const metadata: Metadata = { title: "בנק שירים" };

export default function SongsPage() {
  return (
    <>
      <h1 className="mb-2">בנק שירים</h1>
      <p className="mb-6 text-muted">כל השירים שעובדים איתם בשיעורים, בעברית ובאנגלית.</p>
      <Suspense fallback={<p className="text-muted">טוען שירים…</p>}>
        <SongBankLoader />
      </Suspense>
    </>
  );
}

async function SongBankLoader() {
  const [songs, usage] = await Promise.all([getSongs(), getSongUsage()]);
  return <SongBank songs={songs} usage={usage} />;
}
