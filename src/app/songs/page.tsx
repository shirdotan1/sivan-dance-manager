import type { Metadata } from "next";
import { SongBank } from "@/components/SongBank";

export const metadata: Metadata = { title: "בנק שירים" };

export default function SongsPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">בנק שירים</h1>
      <p className="mb-6 text-muted">כל השירים שעובדים איתם בשיעורים, בעברית ובאנגלית.</p>
      <SongBank />
    </>
  );
}
