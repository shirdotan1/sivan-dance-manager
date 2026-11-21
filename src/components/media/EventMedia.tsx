import { MediaManager } from "@/components/media/MediaManager";
import { getEventMedia, getMediaUsage } from "@/lib/data/media";
import type { MediaOwner } from "@/lib/storage/r2";

/** Media of a lesson or session, with short-lived signed URLs (request time; render inside Suspense). */
export async function EventMedia({ owner }: { owner: MediaOwner }) {
  const [items, usageBytes] = await Promise.all([getEventMedia(owner), getMediaUsage()]);
  return <MediaManager owner={owner} items={items} usageBytes={usageBytes} />;
}

export function EventMediaSkeleton() {
  return (
    <section aria-label="מדיה" className="card card-section">
      <h2 className="mb-3">מדיה</h2>
      <p className="text-muted">טוען תמונות וסרטונים…</p>
    </section>
  );
}
